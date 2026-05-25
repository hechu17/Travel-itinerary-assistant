import { useState, useEffect } from 'react';
import AMapLoader from '@amap/amap-jsapi-loader';
import MapContainer from './components/MapContainer';
import DestinationList from './components/DestinationList';
import ItineraryTimeline from './components/ItineraryTimeline';
import BudgetTracker from './components/BudgetTracker';
import { Compass, Calendar, DollarSign } from 'lucide-react';
import { describeAMapError } from './utils/amapDiagnostics';
import './App.css';

// Initial Mock data for a wow first impression (Beijing Classic Tour)
const INITIAL_DESTINATIONS = [
  { id: '1', name: '北京天安门广场', lng: 116.397428, lat: 39.90923, address: '北京市东城区东长安街', stayDuration: 1, nextTransportMode: 'driving', day: 1 },
  { id: '2', name: '北京故宫博物院', lng: 116.397026, lat: 39.918058, address: '北京市东城区景山前街4号', stayDuration: 3, nextTransportMode: 'walking', day: 1 },
  { id: '3', name: '北京颐和园', lng: 116.273305, lat: 39.992657, address: '北京市海淀区新建宫门路19号', stayDuration: 4, day: 2 }
];

const INITIAL_EXPENSES = [
  { id: 'e1', name: '故宫门票', category: 'tickets', amount: 60, destinationId: '2', date: '05/23' },
  { id: 'e2', name: '颐和园联票', category: 'tickets', amount: 50, destinationId: '3', date: '05/23' },
  { id: 'e3', name: '北京烤鸭晚餐', category: 'food', amount: 280, destinationId: 'general', date: '05/23' },
  { id: 'e4', name: '打车费', category: 'transport', amount: 45, destinationId: 'general', date: '05/23' }
];

const AMAP_LOAD_TIMEOUT_MS = 15000;

function withTimeout(promise, timeoutMs, message) {
  let timeoutId;
  const timeout = new Promise((_, reject) => {
    timeoutId = window.setTimeout(() => reject(new Error(message)), timeoutMs);
  });

  return Promise.race([promise, timeout]).finally(() => window.clearTimeout(timeoutId));
}

export default function App() {
  // Load States from localStorage
  const [destinations, setDestinations] = useState(() => {
    const saved = localStorage.getItem('sp_destinations');
    const parsed = saved ? JSON.parse(saved) : INITIAL_DESTINATIONS;
    return parsed.map((destination, index) => ({
      ...destination,
      day: Math.max(1, Number(destination.day) || (index === parsed.length - 1 && parsed.length > 2 ? 2 : 1)),
    }));
  });
  
  const [expenses, setExpenses] = useState(() => {
    const saved = localStorage.getItem('sp_expenses');
    return saved ? JSON.parse(saved) : INITIAL_EXPENSES;
  });

  const [totalBudget, setTotalBudget] = useState(() => {
    const saved = localStorage.getItem('sp_budget');
    return saved ? parseFloat(saved) : 3000;
  });

  const [amapKey, setAmapKey] = useState(() => {
    return localStorage.getItem('sp_amap_key') || '';
  });

  const [amapSecCode, setAmapSecCode] = useState(() => {
    return localStorage.getItem('sp_amap_seccode') || '';
  });

  const [amapApi, setAmapApi] = useState(null);
  const [amapLoadError, setAmapLoadError] = useState('');

  const [tripStartDate, setTripStartDate] = useState(() => {
    return localStorage.getItem('sp_trip_start_date') || new Date().toISOString().slice(0, 10);
  });

  const [activeTab, setActiveTab] = useState('planner'); // planner, timeline, budget
  const [routes, setRoutes] = useState([]); // Single source of truth from MapContainer

  // Sync to localStorage
  useEffect(() => {
    localStorage.setItem('sp_destinations', JSON.stringify(destinations));
  }, [destinations]);

  useEffect(() => {
    localStorage.setItem('sp_expenses', JSON.stringify(expenses));
  }, [expenses]);

  useEffect(() => {
    localStorage.setItem('sp_budget', totalBudget.toString());
  }, [totalBudget]);

  useEffect(() => {
    localStorage.setItem('sp_trip_start_date', tripStartDate);
  }, [tripStartDate]);

  useEffect(() => {
    let disposed = false;

    if (!amapKey) {
      queueMicrotask(() => {
        if (disposed) return;
        setAmapApi(null);
        setAmapLoadError('');
      });
      return;
    }

    if (amapSecCode) {
      window._AMapSecurityConfig = {
        securityJsCode: amapSecCode,
      };
    } else {
      window._AMapSecurityConfig = undefined;
    }

    withTimeout(
      AMapLoader.load({
        key: amapKey,
        version: '2.0',
        plugins: ['AMap.AutoComplete', 'AMap.PlaceSearch'],
      }),
      AMAP_LOAD_TIMEOUT_MS,
      '高德 JS API 加载超时，请检查网络、Key 白名单、安全密钥或浏览器拦截设置。'
    )
      .then((AMap) => {
        if (disposed) return;
        setAmapApi(AMap);
        setAmapLoadError('');
      })
      .catch((err) => {
        if (disposed) return;
        console.error('高德 JS API 加载失败:', err);
        setAmapApi(null);
        setAmapLoadError(describeAMapError(err));
      });

    return () => {
      disposed = true;
    };
  }, [amapKey, amapSecCode]);

  // Destination actions
  const handleAddDestination = (newDest) => {
    const lastDay = destinations.length > 0 ? destinations[destinations.length - 1].day || 1 : 1;
    setDestinations([...destinations, { ...newDest, nextTransportMode: 'driving', day: lastDay }]);
  };

  const handleRemoveDestination = (id) => {
    setDestinations(destinations.filter(d => d.id !== id));
    setExpenses(expenses.map(e => e.destinationId === id ? { ...e, destinationId: 'general' } : e));
  };

  const handleReorderDestinations = (reordered) => {
    setDestinations(reordered);
  };

  const handleUpdateStayDuration = (id, newDuration) => {
    setDestinations(destinations.map(d => d.id === id ? { ...d, stayDuration: newDuration } : d));
  };

  const handleUpdateDestinationDay = (id, newDay) => {
    setDestinations(destinations.map(d => d.id === id ? { ...d, day: Math.max(1, newDay) } : d));
  };

  const handleUpdateSegmentTransport = (id, newMode) => {
    setDestinations(destinations.map(d => d.id === id ? { ...d, nextTransportMode: newMode } : d));
  };

  // Budget actions
  const handleAddExpense = (newExp) => {
    setExpenses([newExp, ...expenses]);
  };

  const handleRemoveExpense = (id) => {
    setExpenses(expenses.filter(e => e.id !== id));
  };

  const handleUpdateBudget = (newBudget) => {
    setTotalBudget(newBudget);
  };

  // Map Config save
  const handleSaveMapConfig = (key, secCode) => {
    setAmapKey(key);
    setAmapSecCode(secCode);
    localStorage.setItem('sp_amap_key', key);
    localStorage.setItem('sp_amap_seccode', secCode);
    
    setTimeout(() => {
      window.location.reload();
    }, 300);
  };

  // Summary computations
  const totalDistance = routes.reduce((sum, r) => sum + (r.distance || 0), 0);
  const totalDuration = routes.reduce((sum, r) => sum + (r.duration || 0), 0);
  const tripDayCount = Math.max(1, ...destinations.map(d => Number(d.day) || 1));

  const formatDistance = (meters) => {
    if (meters === 0) return '0 米';
    if (meters >= 1000) return `${(meters / 1000).toFixed(1)} km`;
    return `${meters} 米`;
  };

  const formatDuration = (seconds) => {
    if (seconds === 0) return '0 分钟';
    const mins = Math.round(seconds / 60);
    if (mins >= 60) {
      const hrs = Math.floor(mins / 60);
      const remMins = mins % 60;
      return remMins > 0 ? `${hrs}小时${remMins}分钟` : `${hrs}小时`;
    }
    return `${mins}分钟`;
  };

  return (
    <div className="app-container">
      {/* Premium Header */}
      <header className="app-header glass-panel">
        <div className="header-left">
          <div className="logo-glow-box">
            <Compass className="app-logo-icon animate-spin-slow" size={24} />
          </div>
          <div className="header-title-block">
            <h1>SmartPath Travel</h1>
            <p className="subtitle">智能多目的地分段规划与记账系统</p>
          </div>
        </div>

        <div className="header-right">
          {routes.length > 0 && (
            <div className="header-stats glass-panel">
              <div className="h-stat-item">
                <span className="h-stat-lbl">总计路程:</span>
                <span className="h-stat-val neon-purple">{formatDistance(totalDistance)}</span>
              </div>
              <div className="h-stat-divider"></div>
              <div className="h-stat-item">
                <span className="h-stat-lbl">行车总时:</span>
                <span className="h-stat-val neon-cyan">{formatDuration(totalDuration)}</span>
              </div>
            </div>
          )}
          <div className="live-pill">
            <span className="pill-dot blink"></span>
            <span className="pill-text">高德引擎就绪</span>
          </div>
        </div>
      </header>

      {/* Main Grid Layout */}
      <main className="dashboard-grid-layout">
        {/* Left Control Panel */}
        <section className="dashboard-left-panel glass-panel">
          {/* Tabs Selector */}
          <nav className="neon-tabs-bar">
            <button 
              className={`tab-btn ${activeTab === 'planner' ? 'active' : ''}`}
              onClick={() => setActiveTab('planner')}
            >
              <Compass size={14} />
              <span>行程规划</span>
            </button>
            <button 
              className={`tab-btn ${activeTab === 'timeline' ? 'active' : ''}`}
              onClick={() => setActiveTab('timeline')}
            >
              <Calendar size={14} />
              <span>日程看板</span>
            </button>
            <button 
              className={`tab-btn ${activeTab === 'budget' ? 'active' : ''}`}
              onClick={() => setActiveTab('budget')}
            >
              <DollarSign size={14} />
              <span>预算账本</span>
            </button>
          </nav>

          {/* Tab Viewport - constrained scroll area */}
          <div className="tab-viewport-body">
            {activeTab === 'planner' && (
              <div className="tab-pane-fade">
                <DestinationList
                  destinations={destinations}
                  onAddDestination={handleAddDestination}
                  onRemoveDestination={handleRemoveDestination}
                  onReorderDestinations={handleReorderDestinations}
                  onUpdateStayDuration={handleUpdateStayDuration}
                  onUpdateDestinationDay={handleUpdateDestinationDay}
                  onUpdateSegmentTransport={handleUpdateSegmentTransport}
                  routes={routes}
                  tripDayCount={tripDayCount}
                  amapApi={amapApi}
                  amapLoadError={amapLoadError}
                />
              </div>
            )}

            {activeTab === 'timeline' && (
              <div className="tab-pane-fade">
                <ItineraryTimeline
                  destinations={destinations}
                  routes={routes}
                  tripStartDate={tripStartDate}
                  onTripStartDateChange={setTripStartDate}
                />
              </div>
            )}

            {activeTab === 'budget' && (
              <div className="tab-pane-fade">
                <BudgetTracker
                  destinations={destinations}
                  expenses={expenses}
                  totalBudget={totalBudget}
                  onAddExpense={handleAddExpense}
                  onRemoveExpense={handleRemoveExpense}
                  onUpdateBudget={handleUpdateBudget}
                />
              </div>
            )}
          </div>
        </section>

        {/* Right Map Canvas Panel */}
        <section className="dashboard-right-panel">
          <MapContainer
            destinations={destinations}
            amapKey={amapKey}
            amapSecurityCode={amapSecCode}
            amapApi={amapApi}
            amapLoadError={amapLoadError}
            onSaveConfig={handleSaveMapConfig}
            onRoutesCalculated={setRoutes} // Dynamic routes sync to App.jsx state
            routes={routes}
          />
        </section>
      </main>
    </div>
  );
}

import { Car, Bus, Footprints, Bike } from 'lucide-react';
import './TransportSelector.css';

export default function TransportSelector({
  activeMode = 'driving', // driving, transit, walking, bicycling
  onChangeMode,
  routes = []
}) {
  const modes = [
    { id: 'driving', label: '驾车出行', icon: Car, color: '#8b5cf6' },
    { id: 'transit', label: '公共交通', icon: Bus, color: '#06b6d4' },
    { id: 'walking', label: '休闲步行', icon: Footprints, color: '#10b981' },
    { id: 'bicycling', label: '绿色骑行', icon: Bike, color: '#f59e0b' }
  ];

  // Sum up total duration and distance from routes
  const totalDistance = routes.reduce((sum, r) => sum + (r.distance || 0), 0);
  const totalDuration = routes.reduce((sum, r) => sum + (r.duration || 0), 0);

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
    <div className="transport-selector glass-panel">
      {/* Mode Selector Tabs */}
      <div className="mode-tabs">
        {modes.map((mode) => {
          const Icon = mode.icon;
          const isActive = activeMode === mode.id;
          
          return (
            <button
              key={mode.id}
              className={`mode-tab-btn ${isActive ? 'active' : ''}`}
              style={{ '--accent-color': mode.color }}
              onClick={() => onChangeMode(mode.id)}
            >
              <Icon size={18} className="tab-icon" />
              <span className="tab-label">{mode.label}</span>
              {isActive && <div className="tab-glowing-bar"></div>}
            </button>
          );
        })}
      </div>

      {/* Summary Analytics Card */}
      {routes.length > 0 && (
        <div className="route-stats-summary">
          <div className="stat-box">
            <span className="stat-label">总计路程</span>
            <span className="stat-value neon-purple">{formatDistance(totalDistance)}</span>
          </div>
          <div className="stat-divider"></div>
          <div className="stat-box">
            <span className="stat-label">总计交通耗时</span>
            <span className="stat-value neon-cyan">{formatDuration(totalDuration)}</span>
          </div>
          <div className="stat-divider"></div>
          <div className="stat-box">
            <span className="stat-label">路线阶段</span>
            <span className="stat-value">{routes.length} 段</span>
          </div>
        </div>
      )}
    </div>
  );
}

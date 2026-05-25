import { useEffect, useRef, useState } from 'react';
import { MapPin, Trash2, ArrowUp, ArrowDown, Clock, Search, Navigation } from 'lucide-react';
import { describeAMapError, describeAMapStatus } from '../utils/amapDiagnostics';
import './DestinationList.css';

const SEARCH_DEBOUNCE_MS = 600;

function CalendarDayBadge({ day }) {
  return <span className="calendar-day-badge">D{day}</span>;
}

function loadAMapPlugin(AMap, pluginName) {
  return new Promise((resolve, reject) => {
    if (!AMap) {
      reject(new Error('高德地图 JS API 还没有加载完成'));
      return;
    }

    const pluginClassName = pluginName.replace('AMap.', '');
    if (AMap[pluginClassName]) {
      resolve();
      return;
    }

    const loader = typeof AMap.service === 'function' ? AMap.service.bind(AMap) : AMap.plugin.bind(AMap);
    loader([pluginName], () => {
      if (AMap[pluginClassName]) {
        resolve();
      } else {
        reject(new Error(`${pluginName} 插件加载失败`));
      }
    });
  });
}

function readAMapError(status, result) {
  return describeAMapStatus(status, result);
}

function normalizeLocation(location) {
  if (!location) return null;

  if (Array.isArray(location)) {
    return {
      lng: Number(location[0]),
      lat: Number(location[1]),
    };
  }

  return {
    lng: Number(location.lng),
    lat: Number(location.lat),
  };
}

function normalizePoi(poi) {
  const location = normalizeLocation(poi.location);
  if (!location || !Number.isFinite(location.lng) || !Number.isFinite(location.lat)) return null;

  return {
    id: poi.id || `${poi.name}-${location.lng}-${location.lat}`,
    name: poi.name,
    lng: location.lng,
    lat: location.lat,
    address: poi.address || poi.district || poi.adname || '高德地图地点',
  };
}

function searchByPlaceSearch(AMap, keyword) {
  return new Promise((resolve, reject) => {
    loadAMapPlugin(AMap, 'AMap.PlaceSearch')
      .then(() => {
        const placeSearch = new AMap.PlaceSearch({
          city: '全国',
          citylimit: false,
          pageSize: 8,
          pageIndex: 1,
        });

        placeSearch.search(keyword, (status, result) => {
          if (status !== 'complete' || !result?.poiList?.pois) {
            reject(new Error(readAMapError(status, result)));
            return;
          }

          resolve(result.poiList.pois.map(normalizePoi).filter(Boolean));
        });
      })
      .catch(reject);
  });
}

export default function DestinationList({
  destinations = [],
  onAddDestination,
  onRemoveDestination,
  onReorderDestinations,
  onUpdateStayDuration,
  onUpdateDestinationDay,
  onUpdateSegmentTransport,
  routes = [],
  tripDayCount = 1,
  amapApi = null,
  amapLoadError = '',
}) {
  const [searchQuery, setSearchQuery] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [searchStatus, setSearchStatus] = useState('');
  const suggestRef = useRef(null);
  const nextDestinationId = useRef(0);

  useEffect(() => {
    const keyword = searchQuery.trim();
    let isMounted = true;

    if (!keyword) {
      queueMicrotask(() => {
        if (!isMounted) return;
        setSuggestions([]);
        setSearchStatus('');
      });
      return;
    }

    const searchByAMap = async () => {
      try {
        if (amapLoadError) {
          throw new Error(`高德地图加载失败：${amapLoadError}`);
        }

        if (!amapApi) {
          throw new Error('高德地图 JS API 还没有加载完成');
        }

        setSearchStatus('正在通过高德搜索地点...');
        await loadAMapPlugin(amapApi, 'AMap.AutoComplete');

        const autoComplete = new amapApi.AutoComplete({
          city: '全国',
          citylimit: false,
        });

        autoComplete.search(keyword, async (status, result) => {
          if (!isMounted) return;

          if (status !== 'complete' || !result?.tips) {
            setSuggestions([]);
            setSearchStatus(`高德联想搜索失败：${readAMapError(status, result)}`);
            return;
          }

          const validTips = result.tips.map(normalizePoi).filter(Boolean);

          if (validTips.length > 0) {
            setSuggestions(validTips);
            setSearchStatus('');
            return;
          }

          try {
            const placeResults = await searchByPlaceSearch(amapApi, keyword);
            if (!isMounted) return;
            setSuggestions(placeResults);
            setSearchStatus(placeResults.length > 0 ? '' : '高德没有返回带坐标的地点结果。');
          } catch (err) {
            if (!isMounted) return;
            setSuggestions([]);
            setSearchStatus(`高德地点搜索失败：${describeAMapError(err)}`);
          }
        });
      } catch (err) {
        if (!isMounted) return;
        setSuggestions([]);
        setSearchStatus(`高德地点搜索不可用：${describeAMapError(err)}`);
      }
    };

    setSearchStatus('等待输入完成...');
    const searchTimer = window.setTimeout(searchByAMap, SEARCH_DEBOUNCE_MS);

    return () => {
      isMounted = false;
      window.clearTimeout(searchTimer);
    };
  }, [searchQuery, amapApi, amapLoadError]);

  useEffect(() => {
    function handleClickOutside(event) {
      if (suggestRef.current && !suggestRef.current.contains(event.target)) {
        setShowSuggestions(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelectSuggestion = (poi) => {
    nextDestinationId.current += 1;
    onAddDestination({
      id: `amap-${nextDestinationId.current}`,
      name: poi.name,
      lng: poi.lng,
      lat: poi.lat,
      address: poi.address,
      stayDuration: 2,
      day: tripDayCount,
    });
    setSearchQuery('');
    setSuggestions([]);
    setSearchStatus('');
    setShowSuggestions(false);
  };

  const moveItem = (index, direction) => {
    const newIndex = index + direction;
    if (newIndex < 0 || newIndex >= destinations.length) return;

    const newDestinations = [...destinations];
    const temp = newDestinations[index];
    newDestinations[index] = newDestinations[newIndex];
    newDestinations[newIndex] = temp;

    onReorderDestinations(newDestinations);
  };

  const formatDistance = (meters) => {
    if (!meters) return null;
    if (meters >= 1000) return `${(meters / 1000).toFixed(1)} km`;
    return `${meters} 米`;
  };

  const formatDuration = (seconds) => {
    if (!seconds) return null;
    const mins = Math.round(seconds / 60);
    if (mins >= 60) {
      const hrs = Math.floor(mins / 60);
      const remMins = mins % 60;
      return remMins > 0 ? `${hrs}h${remMins}m` : `${hrs}h`;
    }
    return `${mins}m`;
  };

  const dayOptions = Array.from({ length: tripDayCount + 1 }, (_, index) => index + 1);

  return (
    <div className="dest-manager">
      <h2 className="section-title">
        <Navigation size={18} className="neon-purple" />
        目的地行程链
      </h2>

      <div className="search-box-container" ref={suggestRef}>
        <div className="search-input-wrapper">
          <Search className="search-icon" size={16} />
          <input
            type="text"
            className="input-text search-dest-input"
            placeholder="通过高德地图搜索国内经停点"
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setShowSuggestions(true);
            }}
            onFocus={() => setShowSuggestions(true)}
          />
          {searchQuery && (
            <button className="search-clear-btn" onClick={() => setSearchQuery('')} title="清空搜索">
              x
            </button>
          )}
        </div>

        {showSuggestions && suggestions.length > 0 && (
          <div className="suggestions-dropdown glass-panel">
            {suggestions.map((poi, idx) => (
              <div key={`${poi.id}-${idx}`} className="suggestion-item" onClick={() => handleSelectSuggestion(poi)}>
                <MapPin className="suggest-pin" size={14} />
                <div className="suggest-info">
                  <div className="suggest-name">{poi.name}</div>
                  <div className="suggest-addr">{poi.address}</div>
                </div>
              </div>
            ))}
          </div>
        )}

        {showSuggestions && searchStatus && <div className="suggestions-dropdown glass-panel amap-search-status">{searchStatus}</div>}
      </div>

      <div className="destinations-scroll-area">
        {destinations.length === 0 ? (
          <div className="destinations-empty">
            <p>路线还没有目的地。请先配置高德 API，然后在上方搜索并添加地点。</p>
          </div>
        ) : (
          <div className="destination-cards-list">
            {destinations.map((dest, index) => {
              const isStart = index === 0;
              const isEnd = index === destinations.length - 1;
              const routeToNext = routes[index];

              return (
                <div key={dest.id} className="destination-card-wrapper">
                  <div className={`destination-card glass-panel ${isStart ? 'border-start' : isEnd ? 'border-end' : ''}`}>
                    <div className={`dest-node-badge ${isStart ? 'badge-start' : isEnd ? 'badge-end' : 'badge-waypoint'}`}>
                      {index + 1}
                    </div>

                    <div className="dest-card-body">
                      <div className="dest-card-header">
                        <h4>{dest.name}</h4>
                        <div className="dest-actions">
                          <button className="btn-icon" onClick={() => moveItem(index, -1)} disabled={isStart} title="上移">
                            <ArrowUp size={14} />
                          </button>
                          <button className="btn-icon" onClick={() => moveItem(index, 1)} disabled={isEnd} title="下移">
                            <ArrowDown size={14} />
                          </button>
                          <button className="btn-icon danger" onClick={() => onRemoveDestination(dest.id)} title="删除">
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>

                      <div className="dest-address">{dest.address}</div>

                      <div className="dest-day-selector">
                        <CalendarDayBadge day={dest.day || 1} />
                        <span>安排在</span>
                        <select
                          value={dest.day || 1}
                          className="duration-select day-select"
                          onChange={(e) => onUpdateDestinationDay(dest.id, Number(e.target.value))}
                        >
                          {dayOptions.map((day) => (
                            <option key={day} value={day}>
                              第 {day} 天
                            </option>
                          ))}
                        </select>
                      </div>

                      {!isEnd && (
                        <div className="stay-duration-selector">
                          <Clock size={12} className="duration-icon" />
                          <span>在该站预计游玩</span>
                          <select
                            value={dest.stayDuration}
                            className="duration-select"
                            onChange={(e) => onUpdateStayDuration(dest.id, Number(e.target.value))}
                          >
                            <option value="0.5">30 分钟</option>
                            <option value="1">1 小时</option>
                            <option value="1.5">1.5 小时</option>
                            <option value="2">2 小时</option>
                            <option value="3">3 小时</option>
                            <option value="4">4 小时</option>
                            <option value="6">6 小时</option>
                            <option value="8">8 小时</option>
                            <option value="24">过夜</option>
                          </select>
                        </div>
                      )}
                    </div>
                  </div>

                  {index < destinations.length - 1 && (
                    <div className="route-connector-line">
                      <div className="connector-path"></div>
                      <div className="connector-travel-selector-bubble glass-panel">
                        <select
                          value={dest.nextTransportMode || 'driving'}
                          className="segment-transport-select-inline"
                          onChange={(e) => onUpdateSegmentTransport(dest.id, e.target.value)}
                        >
                          <option value="driving">驾车</option>
                          <option value="transit">公交</option>
                          <option value="walking">步行</option>
                          <option value="bicycling">骑行</option>
                        </select>
                        {routeToNext && (
                          <div className="segment-travel-metrics">
                            <span className="metrics-duration neon-cyan">{formatDuration(routeToNext.duration)}</span>
                            <span className="metrics-divider">/</span>
                            <span className="metrics-distance">{formatDistance(routeToNext.distance)}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

import { useEffect, useRef, useState } from 'react';
import { Compass, Settings, Info, MapPin, ShieldCheck } from 'lucide-react';
import { describeAMapError, describeAMapStatus } from '../utils/amapDiagnostics';
import './MapContainer.css';

const ROUTE_COLORS = {
  walking: '#10b981',
  bicycling: '#f59e0b',
  transit: '#06b6d4',
  driving: '#8b5cf6',
};

const KNOWN_CITY_NAMES = [
  '北京',
  '上海',
  '天津',
  '重庆',
  '广州',
  '深圳',
  '杭州',
  '成都',
  '西安',
  '南京',
  '武汉',
  '苏州',
  '厦门',
  '青岛',
  '长沙',
  '郑州',
  '昆明',
  '三亚',
  '哈尔滨',
];

function normalizePath(points = []) {
  return points
    .map((point) => {
      if (Array.isArray(point)) {
        return { lng: Number(point[0]), lat: Number(point[1]) };
      }

      return { lng: Number(point.lng), lat: Number(point.lat) };
    })
    .filter((point) => Number.isFinite(point.lng) && Number.isFinite(point.lat));
}

function getAMapFailureMessage(prefix, status, result) {
  return `${prefix}：${describeAMapStatus(status, result)}`;
}

function inferCity(destination) {
  const text = `${destination.name || ''} ${destination.address || ''}`;
  const matched = KNOWN_CITY_NAMES.find((city) => text.includes(city));
  return matched || '北京';
}

function toLngLatArray(point) {
  return [Number(point.lng), Number(point.lat)];
}

function loadAMapPlugin(AMap, pluginName) {
  return new Promise((resolve, reject) => {
    const pluginClassName = pluginName.replace('AMap.', '');
    if (AMap?.[pluginClassName]) {
      resolve();
      return;
    }

    const loader = typeof AMap.service === 'function' ? AMap.service.bind(AMap) : AMap.plugin.bind(AMap);
    loader([pluginName], () => {
      if (AMap?.[pluginClassName]) {
        resolve();
      } else {
        reject(new Error(`${pluginName} 插件加载失败`));
      }
    });
  });
}

export default function MapContainer({
  destinations = [],
  amapKey = '',
  amapSecurityCode = '',
  amapApi = null,
  amapLoadError = '',
  onSaveConfig,
  onRoutesCalculated,
}) {
  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const [mapInstance, setMapInstance] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [routeStatus, setRouteStatus] = useState('');
  const [diagnosticStatus, setDiagnosticStatus] = useState('');
  const [diagnosticResults, setDiagnosticResults] = useState([]);
  const [diagnosticContext, setDiagnosticContext] = useState(null);
  const [diagnosticRunning, setDiagnosticRunning] = useState(false);
  const [showConfig, setShowConfig] = useState(false);
  const [inputKey, setInputKey] = useState(amapKey);
  const [inputSecCode, setInputSecCode] = useState(amapSecurityCode);

  useEffect(() => {
    let disposed = false;

    if (!amapKey) {
      mapInstanceRef.current?.destroy();
      mapInstanceRef.current = null;
      queueMicrotask(() => {
        if (disposed) return;
        setMapInstance(null);
        setError('请先配置高德地图 JS API Key。当前不会启用 Mock 地图或本地替代路线。');
        setLoading(false);
        onRoutesCalculated([]);
      });
      return;
    }

    if (amapLoadError) {
      mapInstanceRef.current?.destroy();
      mapInstanceRef.current = null;
      queueMicrotask(() => {
        if (disposed) return;
        setMapInstance(null);
        setError(`高德地图加载失败：${amapLoadError}`);
        setLoading(false);
        onRoutesCalculated([]);
      });
      return;
    }

    if (!amapApi) {
      queueMicrotask(() => {
        if (disposed) return;
        setLoading(true);
        setError(null);
        setRouteStatus('');
      });
      return;
    }

    queueMicrotask(() => {
      if (disposed) return;
      setLoading(true);
      setError(null);
      setRouteStatus('');
    });

    let rafId = 0;

    const createMap = () => {
      if (disposed) return;

      if (!mapRef.current) {
        rafId = window.requestAnimationFrame(createMap);
        return;
      }

      try {
        mapInstanceRef.current?.destroy();

        const map = new amapApi.Map(mapRef.current, {
          zoom: 11,
          center: [116.397428, 39.90923],
          viewMode: '3D',
          pitch: 35,
        });

        mapInstanceRef.current = map;
        setMapInstance(map);
        setLoading(false);
      } catch (err) {
        console.error('高德地图实例初始化失败:', err);
        mapInstanceRef.current = null;
        setMapInstance(null);
        setLoading(false);
        setError(`高德地图初始化失败：${describeAMapError(err)}`);
        onRoutesCalculated([]);
      }
    };

    rafId = window.requestAnimationFrame(createMap);

    return () => {
      disposed = true;
      if (rafId) window.cancelAnimationFrame(rafId);
    };
  }, [amapKey, amapSecurityCode, amapApi, amapLoadError, onRoutesCalculated]);

  useEffect(() => {
    return () => {
      mapInstanceRef.current?.destroy();
      mapInstanceRef.current = null;
    };
  }, []);

  const queryAMapRoute = (AMap, start, end, mode) => {
    return new Promise((resolve, reject) => {
      let service;
      const origin = toLngLatArray(start);
      const destination = toLngLatArray(end);
      const options = {
        hideMarkers: true,
        autoFitView: false,
      };

      const callback = (status, result) => {
        if (status !== 'complete' || !result) {
          reject(new Error(getAMapFailureMessage(`${start.name} 到 ${end.name} 路线规划失败`, status, result)));
          return;
        }

        if (mode === 'transit' && result.plans?.[0]) {
          const plan = result.plans[0];
          const path = plan.segments.flatMap((segment) => {
            if (segment.transit?.path) return normalizePath(segment.transit.path);
            if (segment.walking?.path) return normalizePath(segment.walking.path);
            return [];
          });

          resolve({
            distance: Number(plan.distance) || 0,
            duration: Number(plan.time) || 0,
            path,
            mode,
            source: 'amap',
          });
          return;
        }

        const route = result.routes?.[0];
        if (!route) {
          reject(new Error(getAMapFailureMessage(`${start.name} 到 ${end.name} 未返回可用路线`, status, result)));
          return;
        }

        const path = route.steps?.flatMap((step) => normalizePath(step.path)) || [];
        resolve({
          distance: Number(route.distance) || 0,
          duration: Number(route.time) || 0,
          path,
          mode,
          source: 'amap',
        });
      };

      const runSearch = async () => {
        if (mode === 'walking') {
          await loadAMapPlugin(AMap, 'AMap.Walking');
          service = new AMap.Walking(options);
          service.search(origin, destination, callback);
        } else if (mode === 'bicycling') {
          await loadAMapPlugin(AMap, 'AMap.Riding');
          service = new AMap.Riding(options);
          service.search(origin, destination, callback);
        } else if (mode === 'transit') {
          await loadAMapPlugin(AMap, 'AMap.Transfer');
          service = new AMap.Transfer({
            ...options,
            city: inferCity(start),
            cityd: inferCity(end),
          });
          service.search(origin, destination, callback);
        } else {
          await loadAMapPlugin(AMap, 'AMap.Driving');
          service = new AMap.Driving({
            ...options,
            policy: AMap.DrivingPolicy?.LEAST_TIME ?? 0,
            extensions: 'all',
            showTraffic: false,
          });
          service.search(origin, destination, callback);
        }
      };

      runSearch().catch(reject);
    });
  };

  const runAMapDiagnostics = async () => {
    if (!amapApi) {
      setDiagnosticStatus('高德 JS API 尚未加载完成，无法诊断服务权限。');
      setDiagnosticResults([]);
      return;
    }

    setDiagnosticRunning(true);
    setDiagnosticStatus('正在检查高德服务权限...');
    setDiagnosticResults([]);
    setDiagnosticContext({
      origin: window.location.origin,
      host: window.location.host,
      protocol: window.location.protocol,
      referrer: document.referrer || '无',
      hasKey: Boolean(amapKey),
      hasSecurityCode: Boolean(amapSecurityCode),
    });

    const tests = [
      {
        name: '地点联想 AutoComplete',
        plugin: 'AMap.AutoComplete',
        run: () =>
          new Promise((resolve, reject) => {
            const service = new amapApi.AutoComplete({ city: '全国', citylimit: false });
            service.search('北京天安门', (status, result) => {
              if (status === 'complete' && result?.tips?.length > 0) resolve(`${result.tips.length} 条候选`);
              else reject(new Error(describeAMapStatus(status, result)));
            });
          }),
      },
      {
        name: '地点搜索 PlaceSearch',
        plugin: 'AMap.PlaceSearch',
        run: () =>
          new Promise((resolve, reject) => {
            const service = new amapApi.PlaceSearch({ city: '全国', citylimit: false, pageSize: 5 });
            service.search('北京天安门', (status, result) => {
              if (status === 'complete' && result?.poiList?.pois?.length > 0) resolve(`${result.poiList.pois.length} 条 POI`);
              else reject(new Error(describeAMapStatus(status, result)));
            });
          }),
      },
      {
        name: '步行路线 Walking',
        plugin: 'AMap.Walking',
        run: () =>
          new Promise((resolve, reject) => {
            const service = new amapApi.Walking({ hideMarkers: true, autoFitView: false });
            service.search([116.397428, 39.90923], [116.397026, 39.918058], (status, result) => {
              const route = result?.routes?.[0];
              if (status === 'complete' && route) resolve(`${Math.round((route.distance || 0))} 米`);
              else reject(new Error(describeAMapStatus(status, result)));
            });
          }),
      },
      {
        name: '驾车路线 Driving',
        plugin: 'AMap.Driving',
        run: () =>
          new Promise((resolve, reject) => {
            const service = new amapApi.Driving({
              hideMarkers: true,
              autoFitView: false,
              policy: amapApi.DrivingPolicy?.LEAST_TIME ?? 0,
            });
            service.search([116.427281, 39.902476], [116.321218, 39.895116], (status, result) => {
              const route = result?.routes?.[0];
              if (status === 'complete' && route) resolve(`${((route.distance || 0) / 1000).toFixed(1)} km`);
              else reject(new Error(describeAMapStatus(status, result)));
            });
          }),
      },
      {
        name: '骑行路线 Riding',
        plugin: 'AMap.Riding',
        run: () =>
          new Promise((resolve, reject) => {
            const service = new amapApi.Riding({ hideMarkers: true, autoFitView: false });
            service.search([116.397428, 39.90923], [116.410886, 39.881949], (status, result) => {
              const route = result?.routes?.[0];
              if (status === 'complete' && route) resolve(`${((route.distance || 0) / 1000).toFixed(1)} km`);
              else reject(new Error(describeAMapStatus(status, result)));
            });
          }),
      },
      {
        name: '公交路线 Transfer',
        plugin: 'AMap.Transfer',
        run: () =>
          new Promise((resolve, reject) => {
            const service = new amapApi.Transfer({
              city: '北京',
              cityd: '北京',
              hideMarkers: true,
              autoFitView: false,
            });
            service.search([116.397428, 39.90923], [116.273305, 39.992657], (status, result) => {
              const plan = result?.plans?.[0];
              if (status === 'complete' && plan) resolve(`${Math.round((plan.time || 0) / 60)} 分钟`);
              else reject(new Error(describeAMapStatus(status, result)));
            });
          }),
      },
    ];

    const results = [];

    for (const test of tests) {
      try {
        await loadAMapPlugin(amapApi, test.plugin);
        const detail = await test.run();
        results.push({ name: test.name, ok: true, detail });
      } catch (err) {
        results.push({ name: test.name, ok: false, detail: describeAMapError(err) });
      }
      setDiagnosticResults([...results]);
    }

    const failed = results.filter((result) => !result.ok);
    setDiagnosticStatus(
      failed.length === 0
        ? '服务权限检查通过：当前 Key 可调用搜索与路线规划服务。'
        : `发现 ${failed.length} 项服务调用失败，请在高德控制台检查对应服务权限、Referer 白名单与安全密钥。`
    );
    setDiagnosticRunning(false);
  };

  useEffect(() => {
    if (!mapInstance || !amapApi) return;

    mapInstance.clearMap();
    queueMicrotask(() => setRouteStatus(''));

    if (destinations.length === 0) {
      onRoutesCalculated([]);
      return;
    }

    const AMap = amapApi;

    destinations.forEach((dest, index) => {
      const isStart = index === 0;
      const isEnd = index === destinations.length - 1;
      const markerContent = document.createElement('div');
      markerContent.className = `amap-marker-custom ${isStart ? 'start' : isEnd ? 'end' : 'waypoint'}`;
      markerContent.innerHTML = `
        <div class="marker-pin">
          <span>${index + 1}</span>
        </div>
        <div class="marker-label">${dest.name}</div>
      `;

      new AMap.Marker({
        position: [dest.lng, dest.lat],
        content: markerContent,
        offset: new AMap.Pixel(-18, -40),
        title: dest.name,
        map: mapInstance,
      });
    });

    if (destinations.length < 2) {
      onRoutesCalculated([]);
      mapInstance.setFitView();
      return;
    }

    let cancelled = false;

    const loadRoutes = async () => {
      setRouteStatus('正在通过高德地图规划路线...');
      const liveRoutes = [];
      const failures = [];

      for (let i = 0; i < destinations.length - 1; i += 1) {
        const start = destinations[i];
        const end = destinations[i + 1];
        const mode = start.nextTransportMode || 'driving';

        try {
          const liveRoute = await queryAMapRoute(AMap, start, end, mode);
          if (cancelled) return;

          liveRoutes.push(liveRoute);

          if (liveRoute.path.length > 0) {
            new AMap.Polyline({
              path: liveRoute.path.map((point) => [point.lng, point.lat]),
              strokeColor: ROUTE_COLORS[mode] || ROUTE_COLORS.driving,
              strokeWeight: 6,
              strokeOpacity: 0.85,
              showDir: true,
              lineJoin: 'round',
              map: mapInstance,
            });
          }
        } catch (err) {
          console.warn('高德路线规划失败:', err);
          const modeHint =
            mode === 'driving'
              ? '；当前交通方式为驾车，景区或步行区短距离可能没有可返回的驾车路线，可在左侧改成步行再试'
              : '';
          failures.push(`${describeAMapError(err, `${start.name} -> ${end.name}`)}${modeHint}`);
        }
      }

      if (cancelled) return;

      onRoutesCalculated(liveRoutes);
      mapInstance.setFitView();
      setRouteStatus(
        failures.length > 0
          ? `有 ${failures.length} 段路线未能从高德返回：${failures[0]}`
          : '高德路线规划完成'
      );
    };

    loadRoutes();

    return () => {
      cancelled = true;
    };
  }, [mapInstance, destinations, amapApi, onRoutesCalculated]);

  const handleConfigSubmit = (e) => {
    e.preventDefault();
    onSaveConfig(inputKey.trim(), inputSecCode.trim());
    setShowConfig(false);
  };

  const renderEmptyState = () => (
    <div className="map-empty-state amap-required-state">
      <MapPin className="compass-icon" size={60} />
      <h3>等待高德地图连接</h3>
      <p>
        此版本只使用高德地图 API。请配置有效的 Web 端 JS API Key 和安全密钥，地图、地点搜索与路线距离才会开始工作。
      </p>
      <button className="btn-primary" onClick={() => setShowConfig(true)}>
        配置高德凭证
      </button>
      <div className="grid-overlay"></div>
    </div>
  );

  return (
    <div className="map-wrapper glass-panel">
      <div className="map-header">
        <div className="map-title-area">
          <Compass className="icon pulse-compass" />
          <span>高德地图路线仪表盘</span>
        </div>
        <button
          className={`btn-icon config-toggle-btn ${amapKey ? '' : 'neon-pulse-warning'}`}
          onClick={() => setShowConfig(!showConfig)}
          title="配置高德 API Key"
        >
          <Settings size={18} />
        </button>
        <button
          className="btn-icon config-toggle-btn"
          onClick={runAMapDiagnostics}
          title="检查高德服务权限"
          disabled={diagnosticRunning}
        >
          <ShieldCheck size={18} />
        </button>
      </div>

      {showConfig && (
        <div className="config-overlay glass-panel">
          <form onSubmit={handleConfigSubmit} className="config-form">
            <h3>高德地图开发者凭证配置</h3>
            <p className="config-desc">
              请输入高德 Web 端 JS API Key。高德 JS API 2.0 通常还需要安全密钥。路线服务失败时，底部状态会直接显示高德返回的 info、infocode 或 event type。
            </p>
            <div className="form-group">
              <label>高德 Web JS API Key</label>
              <input
                type="text"
                className="input-text"
                placeholder="例如: 8ba5df..."
                value={inputKey}
                onChange={(e) => setInputKey(e.target.value)}
              />
            </div>
            <div className="form-group">
              <label>安全密钥 Security JS Code</label>
              <input
                type="text"
                className="input-text"
                placeholder="高德 JS API 2.0 安全密钥"
                value={inputSecCode}
                onChange={(e) => setInputSecCode(e.target.value)}
              />
            </div>
            <div className="config-btn-group">
              <button type="button" className="btn-secondary" onClick={() => setShowConfig(false)}>
                取消
              </button>
              <button type="submit" className="btn-primary">
                保存并加载
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="map-container-body">
        {loading && (
          <div className="map-loader">
            <div className="spinner"></div>
            <span>正在加载高德地图...</span>
          </div>
        )}

        <div
          ref={mapRef}
          className="real-amap-container"
          style={{ display: mapInstance && !error ? 'block' : 'none' }}
        />

        {(!mapInstance || error) && renderEmptyState()}

        {(error || routeStatus) && (
          <div className="map-status-toast">
            <Info size={14} className="toast-icon neon-cyan" />
            <span className="toast-text">{error || routeStatus}</span>
          </div>
        )}

        {(diagnosticStatus || diagnosticResults.length > 0) && (
          <div className="amap-diagnostics-panel glass-panel">
            <div className="diagnostics-title">
              <ShieldCheck size={14} />
              <span>高德服务权限检查</span>
            </div>
            {diagnosticStatus && <p className="diagnostics-status">{diagnosticStatus}</p>}
            {diagnosticContext && (
              <div className="diagnostics-context">
                <span>当前来源: {diagnosticContext.origin}</span>
                <span>Host: {diagnosticContext.host}</span>
                <span>Referrer: {diagnosticContext.referrer}</span>
                <span>Key: {diagnosticContext.hasKey ? '已填写' : '未填写'} / 安全密钥: {diagnosticContext.hasSecurityCode ? '已填写' : '未填写'}</span>
              </div>
            )}
            {diagnosticResults.length > 0 && (
              <div className="diagnostics-list">
                {diagnosticResults.map((result) => (
                  <div key={result.name} className={`diagnostics-item ${result.ok ? 'ok' : 'fail'}`}>
                    <span>{result.name}</span>
                    <strong>{result.ok ? '通过' : '失败'}</strong>
                    <small>{result.detail}</small>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

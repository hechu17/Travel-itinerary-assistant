import { useMemo, useState } from 'react';
import { Clock, MapPin, Navigation, Calendar, Moon } from 'lucide-react';
import './ItineraryTimeline.css';

const DAY_MINUTES = 24 * 60;

function parseTimeToMins(timeStr) {
  const [hrs, mins] = timeStr.split(':').map(Number);
  return hrs * 60 + mins;
}

function formatMinsToTime(totalMins) {
  const normalized = ((totalMins % DAY_MINUTES) + DAY_MINUTES) % DAY_MINUTES;
  const hrs = Math.floor(normalized / 60);
  const mins = normalized % 60;
  return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
}

function formatDateLabel(startDate, day) {
  if (!startDate) return `第 ${day} 天`;

  const date = new Date(`${startDate}T00:00:00`);
  if (Number.isNaN(date.getTime())) return `第 ${day} 天`;

  date.setDate(date.getDate() + day - 1);
  return date.toLocaleDateString('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    weekday: 'short',
  });
}

function formatDistance(meters) {
  if (!meters) return '0 米';
  if (meters >= 1000) return `${(meters / 1000).toFixed(1)} km`;
  return `${meters} 米`;
}

function formatDuration(seconds) {
  if (!seconds) return '0 分钟';
  const mins = Math.round(seconds / 60);
  if (mins >= 60) {
    const hrs = Math.floor(mins / 60);
    const remMins = mins % 60;
    return remMins > 0 ? `${hrs}h${remMins}m` : `${hrs}h`;
  }
  return `${mins}分钟`;
}

function formatStayLabel(hours) {
  if (hours === 24) return '过夜';
  if (hours < 1) return `${Math.round(hours * 60)} 分钟`;
  return `${hours} 小时`;
}

export default function ItineraryTimeline({
  destinations = [],
  routes = [],
  initialStartTime = '09:00',
  tripStartDate = '',
  onTripStartDateChange,
}) {
  const [startTime, setStartTime] = useState(initialStartTime);

  const dayGroups = useMemo(() => {
    const maxDay = Math.max(1, ...destinations.map((dest) => Number(dest.day) || 1));
    const groups = Array.from({ length: maxDay }, (_, index) => ({
      day: index + 1,
      dateLabel: formatDateLabel(tripStartDate, index + 1),
      items: [],
      totalStayMins: 0,
      totalTravelMins: 0,
    }));

    groups.forEach((group) => {
      const dayDestinations = destinations
        .map((dest, index) => ({ ...dest, originalIndex: index, day: Number(dest.day) || 1 }))
        .filter((dest) => dest.day === group.day);

      let currentMins = parseTimeToMins(startTime);

      dayDestinations.forEach((dest, dayIndex) => {
        const previousDest = destinations[dest.originalIndex - 1];
        const previousDay = Number(previousDest?.day) || 1;
        const isFirstInDay = dayIndex === 0;
        const isStart = dest.originalIndex === 0;
        const isEnd = dest.originalIndex === destinations.length - 1;

        if (isFirstInDay && !isStart && previousDay !== group.day) {
          group.items.push({
            type: 'day-break',
            label: `接续第 ${previousDay} 天行程`,
            route: routes[dest.originalIndex - 1],
          });
        }

        const arrivalTime = formatMinsToTime(currentMins);
        group.items.push({
          type: 'destination',
          name: dest.name,
          action: isStart ? '旅行始发站' : isFirstInDay ? '当日首站' : '到达此站',
          time: arrivalTime,
          isStart,
          isEnd,
          address: dest.address,
        });

        if (!isEnd) {
          const stayMins = Math.round((Number(dest.stayDuration) || 0) * 60);
          const stayStart = currentMins;
          currentMins += stayMins;
          group.totalStayMins += stayMins;

          group.items.push({
            type: 'stay',
            label: formatStayLabel(Number(dest.stayDuration) || 0),
            timeRange: `${formatMinsToTime(stayStart)} - ${formatMinsToTime(currentMins)}`,
          });

          const nextDest = destinations[dest.originalIndex + 1];
          const nextDay = Number(nextDest?.day) || group.day;
          const route = routes[dest.originalIndex];

          if (route && nextDay === group.day) {
            const travelMins = Math.round((route.duration || 0) / 60);
            const travelStart = currentMins;
            currentMins += travelMins;
            group.totalTravelMins += travelMins;

            group.items.push({
              type: 'travel',
              duration: route.duration,
              distance: route.distance,
              timeRange: `${formatMinsToTime(travelStart)} - ${formatMinsToTime(currentMins)}`,
            });
          } else if (route && nextDay !== group.day) {
            group.items.push({
              type: 'overnight-transfer',
              label: `下一站安排在第 ${nextDay} 天`,
              duration: route.duration,
              distance: route.distance,
            });
          }
        }
      });
    });

    return groups;
  }, [destinations, routes, startTime, tripStartDate]);

  if (destinations.length === 0) {
    return (
      <div className="timeline-empty glass-panel">
        <Clock className="timeline-clock-icon pulse-compass" size={24} />
        <p>暂无行程时间线数据，请先添加目的地。</p>
      </div>
    );
  }

  return (
    <div className="itinerary-timeline-panel">
      <div className="timeline-header">
        <h2 className="section-title">
          <Clock size={18} className="neon-cyan" />
          多日日程看板
        </h2>

        <div className="timeline-controls">
          <label className="start-time-picker">
            <span>出行日期</span>
            <input
              type="date"
              className="time-input date-input"
              value={tripStartDate}
              onChange={(e) => onTripStartDateChange?.(e.target.value)}
            />
          </label>
          <label className="start-time-picker">
            <span>每日首站</span>
            <input
              type="time"
              className="time-input"
              value={startTime}
              onChange={(e) => setStartTime(e.target.value)}
            />
          </label>
        </div>
      </div>

      <div className="timeline-scroll-area">
        {dayGroups.map((group) => (
          <section key={group.day} className="timeline-day-section">
            <div className="timeline-day-header glass-panel">
              <div>
                <span className="day-title">第 {group.day} 天</span>
                <span className="day-date">{group.dateLabel}</span>
              </div>
              <div className="day-summary">
                <span>游玩 {Math.round(group.totalStayMins / 60 * 10) / 10}h</span>
                <span>交通 {group.totalTravelMins}m</span>
              </div>
            </div>

            {group.items.length === 0 ? (
              <div className="timeline-day-empty">这一天还没有安排目的地。</div>
            ) : (
              <div className="timeline-container">
                <div className="timeline-backbone"></div>

                {group.items.map((item, idx) => {
                  if (item.type === 'destination') {
                    return (
                      <div key={`timeline-item-${group.day}-${idx}`} className="timeline-card-node">
                        <div className={`timeline-indicator ${item.isStart ? 'green' : item.isEnd ? 'red' : 'purple'}`}>
                          {item.isStart ? <Calendar size={12} /> : <MapPin size={12} />}
                        </div>

                        <div className="timeline-content glass-panel">
                          <div className="timeline-time-badge">
                            <Clock size={11} />
                            {item.time}
                          </div>
                          <div className="timeline-dest-details">
                            <h4>{item.name}</h4>
                            <span className="dest-action-label">{item.action}</span>
                            <p className="dest-address-sub">{item.address}</p>
                          </div>
                        </div>
                      </div>
                    );
                  }

                  if (item.type === 'stay') {
                    return (
                      <div key={`timeline-item-${group.day}-${idx}`} className="timeline-stay-node">
                        <div className="timeline-connector-sub"></div>
                        <div className="timeline-stay-content">
                          <span className="stay-duration-tag neon-cyan">停留 {item.label}</span>
                          <span className="stay-time-range">{item.timeRange}</span>
                        </div>
                      </div>
                    );
                  }

                  if (item.type === 'travel') {
                    return (
                      <div key={`timeline-item-${group.day}-${idx}`} className="timeline-travel-node">
                        <div className="timeline-connector-sub travel-dash"></div>
                        <div className="timeline-travel-content">
                          <Navigation size={10} className="travel-compass-icon" />
                          <span>区间交通 ({formatDuration(item.duration)} / {formatDistance(item.distance)})</span>
                          <span className="travel-time-range">{item.timeRange}</span>
                        </div>
                      </div>
                    );
                  }

                  return (
                    <div key={`timeline-item-${group.day}-${idx}`} className="timeline-transfer-node">
                      <div className="timeline-connector-sub travel-dash"></div>
                      <div className="timeline-transfer-content">
                        <Moon size={11} />
                        <span>{item.label}</span>
                        {(item.route || item.duration) && (
                          <span className="transfer-route-metrics">
                            {formatDuration(item.route?.duration || item.duration)} / {formatDistance(item.route?.distance || item.distance)}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        ))}
      </div>
    </div>
  );
}

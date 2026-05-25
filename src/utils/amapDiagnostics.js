export function describeAMapError(value, fallback = '未返回详细错误信息') {
  if (!value) return fallback;
  if (typeof value === 'string') {
    if (value.includes('[object Event]')) {
      return value.replace(
        '[object Event]',
        '高德 Event 对象（未暴露 info/infocode；通常是服务脚本请求失败、Key 安全密钥/域名白名单/服务权限不匹配，或浏览器拦截了高德服务请求）'
      );
    }
    return value;
  }
  if (value instanceof Error && value.message) return describeAMapError(value.message, fallback);

  const fields = [];
  const seen = new Set();

  const add = (label, data) => {
    if (data === undefined || data === null || data === '') return;
    const text = `${label}: ${describeAMapError(String(data), String(data))}`;
    if (!seen.has(text)) {
      seen.add(text);
      fields.push(text);
    }
  };

  const visit = (source, prefix = '') => {
    if (!source || typeof source !== 'object') return;

    [
      'info',
      'infocode',
      'message',
      'msg',
      'type',
      'status',
      'statusText',
      'code',
      'name',
      'responseURL',
      'src',
      'href',
      'currentSrc',
    ].forEach((key) => add(prefix ? `${prefix}.${key}` : key, source[key]));
  };

  visit(value);
  visit(value.data, 'data');
  visit(value.detail, 'detail');
  visit(value.target, 'target');
  visit(value.currentTarget, 'currentTarget');
  visit(value.error, 'error');

  if (typeof Event !== 'undefined' && value instanceof Event) {
    add('event', value.constructor?.name || 'Event');
    add('event.type', value.type);
  }

  return fields.length > 0 ? fields.join('，') : fallback;
}

export function describeAMapStatus(status, result) {
  const detail = describeAMapError(result, '未返回详细信息');
  return `${status} / ${detail}`;
}

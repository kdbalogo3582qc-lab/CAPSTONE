// Playback positions from review evidence, never a fallback to 00:00.
export function guidelineTime(detail) {
    if (typeof detail?.timestamp !== 'string') return null;
    const match = detail.timestamp.trim().match(/^(?:(\d{1,3}):)?(\d{1,2}):([0-5]\d)(?:\.(\d{1,3}))?$/);
    if (!match || (match[1] !== undefined && Number(match[2]) >= 60)) return null;
    const seconds = Number(match[1] || 0) * 3600 + Number(match[2]) * 60 + Number(match[3]) + Number(`0.${match[4] || '0'}`);
    const whole = Math.floor(seconds);
    const parts = whole >= 3600 ? [Math.floor(whole / 3600), Math.floor(whole / 60) % 60, whole % 60] : [Math.floor(whole / 60), whole % 60];
    const display = parts.map(part => String(part).padStart(2, '0')).join(':') + (match[4] ? `.${match[4].replace(/0+$/, '')}`.replace(/\.$/, '') : '');
    return { seconds, display, label: seconds === 0 ? 'Approx. start of video (00:00)' : `${display} (approx.)` };
}

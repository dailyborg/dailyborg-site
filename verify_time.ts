import { formatTimeAgo } from './src/lib/utils';

const now = Date.now();
const oneMinuteAgo = new Date(now - 60 * 1000).toISOString();
const tenMinutesAgo = new Date(now - 10 * 60 * 1000).toISOString();
const threeHoursAgo = new Date(now - 3 * 60 * 60 * 1000).toISOString();
const threeDaysAgo = new Date(now - 3 * 24 * 60 * 60 * 1000).toISOString();
const tenDaysAgo = new Date(now - 10 * 24 * 60 * 60 * 1000).toISOString();

console.log(`Now: ${new Date().toISOString()}`);
console.log(`1m ago: ${formatTimeAgo(oneMinuteAgo)}`);
console.log(`10m ago: ${formatTimeAgo(tenMinutesAgo)}`);
console.log(`3h ago: ${formatTimeAgo(threeHoursAgo)}`);
console.log(`3d ago: ${formatTimeAgo(threeDaysAgo)}`);
console.log(`10d ago: ${formatTimeAgo(tenDaysAgo)}`);

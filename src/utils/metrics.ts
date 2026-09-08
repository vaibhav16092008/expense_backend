let requestCount = 0;
let errorCount = 0;
const startTime = Date.now();

export const incrementRequestCount = (): void => {
  requestCount++;
};

export const incrementErrorCount = (): void => {
  errorCount++;
};

export const getMetricsData = () => {
  const uptimeSeconds = Math.floor((Date.now() - startTime) / 1000);
  return {
    uptimeSeconds,
    requestCount,
    errorCount,
  };
};

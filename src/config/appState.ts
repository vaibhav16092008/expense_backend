export type AppLifecycleState = "STARTING" | "READY" | "SHUTTING_DOWN";

let currentState: AppLifecycleState = "STARTING";

export const getAppState = (): AppLifecycleState => currentState;

export const setAppState = (state: AppLifecycleState): void => {
  currentState = state;
};

export const isReady = (): boolean => currentState === "READY";

export const isShuttingDown = (): boolean => currentState === "SHUTTING_DOWN";

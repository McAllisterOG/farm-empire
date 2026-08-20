export interface RecoveryGate {
  tryOpen(): boolean;
  release(): void;
  isOpen(): boolean;
}

export function createRecoveryGate(): RecoveryGate;

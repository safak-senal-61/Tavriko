import { RoomStatus } from '@trivia/shared';

export type StateTransitionCallback = (
  from: RoomStatus,
  to: RoomStatus,
  context?: any
) => void;

export class GameStateMachine {
  private currentStatus: RoomStatus;
  private onTransition?: StateTransitionCallback;

  constructor(initialStatus: RoomStatus = 'lobby', onTransition?: StateTransitionCallback) {
    this.currentStatus = initialStatus;
    this.onTransition = onTransition;
  }

  public getStatus(): RoomStatus {
    return this.currentStatus;
  }

  public canTransitionTo(target: RoomStatus): boolean {
    const validTransitions: Record<RoomStatus, RoomStatus[]> = {
      lobby: ['countdown'],
      countdown: ['question_active', 'lobby'],
      question_active: ['round_result', 'game_over'],
      round_result: ['intermission', 'game_over'],
      intermission: ['question_active', 'game_over'],
      game_over: ['lobby'],
    };

    return validTransitions[this.currentStatus]?.includes(target) ?? false;
  }

  public transition(target: RoomStatus, context?: any): boolean {
    if (!this.canTransitionTo(target)) {
      return false;
    }

    const previous = this.currentStatus;
    this.currentStatus = target;
    if (this.onTransition) {
      this.onTransition(previous, target, context);
    }
    return true;
  }

  public reset(): void {
    this.currentStatus = 'lobby';
  }
}

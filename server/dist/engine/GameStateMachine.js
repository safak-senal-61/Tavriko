"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GameStateMachine = void 0;
class GameStateMachine {
    currentStatus;
    onTransition;
    constructor(initialStatus = 'lobby', onTransition) {
        this.currentStatus = initialStatus;
        this.onTransition = onTransition;
    }
    getStatus() {
        return this.currentStatus;
    }
    canTransitionTo(target) {
        const validTransitions = {
            lobby: ['countdown'],
            countdown: ['question_active', 'lobby'],
            question_active: ['round_result', 'game_over'],
            round_result: ['intermission', 'game_over'],
            intermission: ['question_active', 'game_over'],
            game_over: ['lobby'],
        };
        return validTransitions[this.currentStatus]?.includes(target) ?? false;
    }
    transition(target, context) {
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
    reset() {
        this.currentStatus = 'lobby';
    }
}
exports.GameStateMachine = GameStateMachine;

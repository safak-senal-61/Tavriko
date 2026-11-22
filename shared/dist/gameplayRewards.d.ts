import type { InventoryItem, ItemRarity } from './types';
export type GameplayMetric = 'matches' | 'friends' | 'correct' | 'perfect' | 'days';
export type GameplayMetrics = Record<GameplayMetric, number>;
export type GameplayReward = {
    item: InventoryItem;
    key?: InventoryItem;
    metric: GameplayMetric;
    target: number;
    task: string;
};
export type GameplayRewardStatus = {
    id: string;
    current: number;
    claimed: boolean;
};
export declare const GAMEPLAY_REWARDS: readonly GameplayReward[];
export declare function gameplayRewardStatuses(metrics: GameplayMetrics, claimedIds: readonly string[]): GameplayRewardStatus[];
export declare function isPermanentGameplayBadge(id: string, durationHours: number | undefined): boolean;
export type ChestOpening = {
    rarity: ItemRarity;
    key?: InventoryItem;
    alternateKeyIds?: readonly string[];
};
export declare function getChestOpening(id: string): ChestOpening | undefined;

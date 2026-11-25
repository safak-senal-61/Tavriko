import type { NickParticles as NickParticleKind } from '@trivia/shared';

export interface NickParticlesProps {
  kind: NickParticleKind;
  colors: string[];
  width: number;
  height: number;
  /** döngü hızı çarpanı */
  speed?: number;
  /** hero varyantında parçacıklar biraz daha belirgin */
  intensity?: number;
}

import { calculateRisk, type RiskInput } from '@clarity/domain';

export class RiskService {
  assess(input: RiskInput) {
    return calculateRisk(input);
  }
}

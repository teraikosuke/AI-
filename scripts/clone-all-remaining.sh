#!/bin/bash
# =============================================================================
# 残りのLambda関数を一括複製
# =============================================================================

FUNCTIONS=(
  "ats-api-dev-candidates-detail"
  "ats-api-dev-clients-create"
  "ats-api-dev-goal-settings"
  "ats-api-dev-kpi-ads"
  "ats-api-dev-kpi-ads-detail"
  "ats-api-dev-kpi-clients"
  "ats-api-dev-kpi-clients-edit"
  "ats-api-dev-kpi-targets"
  "ats-api-dev-kpi-teleapo"
  "ats-api-dev-kpi-yield"
  "ats-api-dev-kpi-yield-daily"
  "ats-api-dev-kpi-yield-personal"
  "ats-api-dev-members"
  "ats-api-dev-ms-targets"
  "ats-api-dev-teleapo-candidate-contact"
  "ats-api-dev-teleapo-log-create"
  "ats-api-dev-teleapo-logs"
)

for func in "${FUNCTIONS[@]}"; do
  echo ""
  echo "========================================"
  ./scripts/clone-single-lambda.sh "$func"
  sleep 2
done

echo ""
echo "========================================"
echo "全ての関数の複製が完了しました！"
echo "========================================"

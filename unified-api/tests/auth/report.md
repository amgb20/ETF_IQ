# Test Report


| Field        | Value                                                                                        |
| ------------ | -------------------------------------------------------------------------------------------- |
| **Last Run** | 2026-03-23 UTC                                                                               |
| **Command**  | `python -m pytest tests/auth/ --cov=app/auth --cov-report=term-missing --cov-report=json -q` |
| **Status**   | PASS                                                                                         |
| **Passed**   | 162                                                                                          |
| **Failed**   | 0                                                                                            |
| **Skipped**  | 0                                                                                            |
| **Coverage** | 87.4%                                                                                        |


## Coverage Breakdown


| Module                         | Coverage |
| ------------------------------ | -------- |
| `app/auth/__init__.py`         | 100.0%   |
| `app/auth/audit.py`            | 100.0%   |
| `app/auth/auth0.py`            | 98.4%    |
| `app/auth/auth0_management.py` | 0.0%     |
| `app/auth/dependencies.py`     | 100.0%   |
| `app/auth/jwt.py`              | 100.0%   |
| `app/auth/jwt_utils.py`        | 100.0%   |
| `app/auth/otp_limiter.py`      | 96.9%    |
| `app/auth/router.py`           | 96.9%    |
| `app/auth/token_blocklist.py`  | 95.5%    |


## Results


| Test                                                                            | Status | Notes |
| ------------------------------------------------------------------------------- | ------ | ----- |
| test_audit.py::test_login_success_logs_at_info                                  | PASS   |       |
| test_audit.py::test_login_failure_logs_at_warning                               | PASS   |       |
| test_audit.py::test_otp_rate_limited_logs_at_warning                            | PASS   |       |
| test_audit.py::test_account_disabled_logs_at_warning                            | PASS   |       |
| test_audit.py::test_start_rate_limited_logs_at_warning                          | PASS   |       |
| test_audit.py::test_invalid_algorithm_logs_at_warning                           | PASS   |       |
| test_audit.py::test_token_revoked_logs_at_warning                               | PASS   |       |
| test_audit.py::test_logout_logs_at_info                                         | PASS   |       |
| test_audit.py::test_token_refresh_logs_at_info                                  | PASS   |       |
| test_audit.py::test_log_output_is_valid_json                                    | PASS   |       |
| test_audit.py::test_log_json_contains_event_field                               | PASS   |       |
| test_audit.py::test_log_json_contains_email_field                               | PASS   |       |
| test_audit.py::test_log_json_contains_user_id                                   | PASS   |       |
| test_audit.py::test_log_json_contains_ip                                        | PASS   |       |
| test_audit.py::test_log_json_contains_ts_field                                  | PASS   |       |
| test_audit.py::test_log_json_contains_detail_field                              | PASS   |       |
| test_audit.py::test_log_json_none_fields_present                                | PASS   |       |
| test_audit.py::test_persist_skipped_when_persist_audit_log_false                | PASS   |       |
| test_audit.py::test_persist_calls_db_execute_when_enabled                       | PASS   |       |
| test_audit.py::test_persist_never_raises_on_db_error                            | PASS   |       |
| test_audit.py::test_log_auth_event_calls_persist_when_db_provided               | PASS   |       |
| test_audit.py::test_log_auth_event_does_not_call_persist_when_db_none           | PASS   |       |
| test_audit.py::test_auth_event_enum_has_all_expected_values                     | PASS   |       |
| test_audit.py::test_failure_events_set                                          | PASS   |       |
| test_auth0.py::test_decode_auth0_token_rejects_alg_none                         | PASS   |       |
| test_auth0.py::test_decode_auth0_token_rejects_hs256                            | PASS   |       |
| test_auth0.py::test_decode_auth0_token_rejects_hs384                            | PASS   |       |
| test_auth0.py::test_decode_auth0_token_rejects_hs512                            | PASS   |       |
| test_auth0.py::test_decode_auth0_token_rejects_case_insensitive_none            | PASS   |       |
| test_auth0.py::test_decode_auth0_token_rejects_unexpected_algorithm             | PASS   |       |
| test_auth0.py::test_decode_auth0_token_rs256_proceeds_to_jwks_fetch             | PASS   |       |
| test_auth0.py::test_decode_auth0_token_calls_jose_decode_when_key_found         | PASS   |       |
| test_auth0.py::test_get_jwks_fetches_on_first_call                              | PASS   |       |
| test_auth0.py::test_get_jwks_returns_cache_within_ttl                           | PASS   |       |
| test_auth0.py::test_get_jwks_refetches_after_ttl_expires                        | PASS   |       |
| test_auth0.py::test_start_passwordless_sends_correct_payload                    | PASS   |       |
| test_auth0.py::test_start_passwordless_raises_on_auth0_error                    | PASS   |       |
| test_auth0.py::test_start_passwordless_accepts_201_response                     | PASS   |       |
| test_auth0.py::test_verify_passwordless_raises_on_invalid_otp                   | PASS   |       |
| test_auth0.py::test_verify_passwordless_raises_when_no_id_token                 | PASS   |       |
| test_auth0.py::test_verify_passwordless_decodes_id_token                        | PASS   |       |
| test_dependencies.py::test_get_current_user_succeeds_with_valid_cookie          | PASS   |       |
| test_dependencies.py::test_get_current_user_raises_401_when_token_has_no_sub    | PASS   |       |
| test_dependencies.py::test_get_current_user_raises_401_when_no_cookie           | PASS   |       |
| test_dependencies.py::test_get_current_user_raises_401_on_invalid_token         | PASS   |       |
| test_dependencies.py::test_get_current_user_raises_401_when_token_has_no_jti    | PASS   |       |
| test_dependencies.py::test_get_current_user_raises_401_when_token_blocklisted   | PASS   |       |
| test_dependencies.py::test_get_current_user_raises_401_when_user_not_in_db      | PASS   |       |
| test_dependencies.py::test_get_current_user_raises_401_when_user_inactive       | PASS   |       |
| test_dependencies.py::test_get_current_user_raises_401_with_internal_token      | PASS   |       |
| test_dependencies.py::test_require_admin_raises_403_for_user_role               | PASS   |       |
| test_dependencies.py::test_require_admin_allows_admin_role                      | PASS   |       |
| test_dependencies.py::test_require_admin_allows_super_admin_role                | PASS   |       |
| test_dependencies.py::test_require_super_admin_raises_403_for_admin_role        | PASS   |       |
| test_dependencies.py::test_require_user_role_allows_any_authenticated_user      | PASS   |       |
| test_dependencies.py::test_role_hierarchy_values                                | PASS   |       |
| test_dependencies.py::test_role_hierarchy_has_expected_roles                    | PASS   |       |
| test_dependencies.py::test_verify_portfolio_owner_returns_portfolio_when_owner  | PASS   |       |
| test_dependencies.py::test_verify_portfolio_owner_raises_404_when_not_found     | PASS   |       |
| test_dependencies.py::test_verify_portfolio_owner_raises_403_when_not_owner     | PASS   |       |
| test_dependencies.py::test_verify_portfolio_owner_accepts_string_portfolio_id   | PASS   |       |
| test_jwt.py::test_create_access_token_returns_string                            | PASS   |       |
| test_jwt.py::test_create_access_token_payload_sub                               | PASS   |       |
| test_jwt.py::test_create_access_token_payload_email                             | PASS   |       |
| test_jwt.py::test_create_access_token_payload_role                              | PASS   |       |
| test_jwt.py::test_create_access_token_payload_issuer                            | PASS   |       |
| test_jwt.py::test_create_access_token_payload_has_jti                           | PASS   |       |
| test_jwt.py::test_create_access_token_jti_is_unique                             | PASS   |       |
| test_jwt.py::test_create_access_token_exp_in_future                             | PASS   |       |
| test_jwt.py::test_create_access_token_exp_within_configured_window              | PASS   |       |
| test_jwt.py::test_create_access_token_uses_hs256_algorithm                      | PASS   |       |
| test_jwt.py::test_decode_token_returns_dict_for_valid_token                     | PASS   |       |
| test_jwt.py::test_decode_token_correct_sub                                      | PASS   |       |
| test_jwt.py::test_decode_token_correct_email                                    | PASS   |       |
| test_jwt.py::test_decode_token_correct_role                                     | PASS   |       |
| test_jwt.py::test_decode_token_correct_issuer                                   | PASS   |       |
| test_jwt.py::test_decode_token_jti_present                                      | PASS   |       |
| test_jwt.py::test_decode_token_raises_on_tampered_signature                     | PASS   |       |
| test_jwt.py::test_decode_token_raises_on_wrong_secret                           | PASS   |       |
| test_jwt.py::test_decode_token_raises_on_expired_token                          | PASS   |       |
| test_jwt.py::test_decode_token_raises_on_wrong_issuer                           | PASS   |       |
| test_jwt.py::test_decode_token_raises_on_missing_issuer                         | PASS   |       |
| test_jwt.py::test_decode_token_raises_on_garbage_input                          | PASS   |       |
| test_jwt.py::test_decode_token_raises_on_empty_string                           | PASS   |       |
| test_jwt_utils.py::test_create_internal_token_returns_string                    | PASS   |       |
| test_jwt_utils.py::test_create_internal_token_issuer                            | PASS   |       |
| test_jwt_utils.py::test_create_internal_token_custom_payload_preserved          | PASS   |       |
| test_jwt_utils.py::test_create_internal_token_custom_expiry                     | PASS   |       |
| test_jwt_utils.py::test_create_internal_token_default_expiry_uses_settings      | PASS   |       |
| test_jwt_utils.py::test_create_internal_token_algorithm_is_hs256                | PASS   |       |
| test_jwt_utils.py::test_verify_internal_token_returns_dict                      | PASS   |       |
| test_jwt_utils.py::test_verify_internal_token_correct_claims                    | PASS   |       |
| test_jwt_utils.py::test_verify_internal_token_raises_on_wrong_issuer            | PASS   |       |
| test_jwt_utils.py::test_verify_internal_token_raises_on_expired_token           | PASS   |       |
| test_jwt_utils.py::test_verify_internal_token_raises_on_tampered_signature      | PASS   |       |
| test_jwt_utils.py::test_verify_internal_token_raises_on_wrong_secret            | PASS   |       |
| test_jwt_utils.py::test_verify_internal_token_raises_on_garbage_input           | PASS   |       |
| test_jwt_utils.py::test_verify_internal_token_raises_on_empty_token             | PASS   |       |
| test_jwt_utils.py::test_verify_internal_token_raises_without_exp                | PASS   |       |
| test_otp_limiter.py::test_redis_key_normalises_email_to_lowercase               | PASS   |       |
| test_otp_limiter.py::test_redis_key_strips_whitespace                           | PASS   |       |
| test_otp_limiter.py::test_redis_key_includes_prefix                             | PASS   |       |
| test_otp_limiter.py::test_check_otp_rate_limit_allows_under_limit               | PASS   |       |
| test_otp_limiter.py::test_check_otp_rate_limit_allows_exactly_at_limit          | PASS   |       |
| test_otp_limiter.py::test_check_otp_rate_limit_raises_429_over_limit            | PASS   |       |
| test_otp_limiter.py::test_check_otp_rate_limit_429_detail_message               | PASS   |       |
| test_otp_limiter.py::test_check_otp_rate_limit_fails_open_when_redis_none       | PASS   |       |
| test_otp_limiter.py::test_check_otp_rate_limit_fails_open_on_pipeline_exception | PASS   |       |
| test_otp_limiter.py::test_check_start_rate_limit_allows_under_limit             | PASS   |       |
| test_otp_limiter.py::test_check_start_rate_limit_raises_429_over_limit          | PASS   |       |
| test_otp_limiter.py::test_check_start_rate_limit_fails_open_when_redis_none     | PASS   |       |
| test_otp_limiter.py::test_reset_otp_rate_limit_deletes_correct_key              | PASS   |       |
| test_otp_limiter.py::test_reset_otp_rate_limit_skips_when_redis_none            | PASS   |       |
| test_otp_limiter.py::test_reset_otp_rate_limit_fails_open_on_exception          | PASS   |       |
| test_otp_limiter.py::test_check_otp_rate_limit_emits_otp_rate_limited_event     | PASS   |       |
| test_otp_limiter.py::test_check_start_rate_limit_emits_start_rate_limited_event | PASS   |       |
| test_otp_limiter.py::test_otp_get_redis_returns_none_when_use_redis_false       | PASS   |       |
| test_otp_limiter.py::test_otp_get_redis_returns_none_on_exception               | PASS   |       |
| test_router.py::test_start_returns_200_on_success                               | PASS   |       |
| test_router.py::test_start_returns_429_when_rate_limit_exceeded                 | PASS   |       |
| test_router.py::test_start_returns_400_on_auth0_value_error                     | PASS   |       |
| test_router.py::test_start_returns_422_on_invalid_email                         | PASS   |       |
| test_router.py::test_start_returns_500_on_unexpected_exception                  | PASS   |       |
| test_router.py::test_verify_returns_200_and_sets_cookies                        | PASS   |       |
| test_router.py::test_verify_returns_user_dict                                   | PASS   |       |
| test_router.py::test_verify_returns_401_on_invalid_otp                          | PASS   |       |
| test_router.py::test_verify_returns_403_when_email_not_in_db                    | PASS   |       |
| test_router.py::test_verify_returns_403_when_user_inactive                      | PASS   |       |
| test_router.py::test_verify_returns_429_when_otp_limit_exceeded                 | PASS   |       |
| test_router.py::test_verify_resets_rate_limit_on_success                        | PASS   |       |
| test_router.py::test_refresh_returns_401_when_no_cookie                         | PASS   |       |
| test_router.py::test_refresh_returns_200_with_valid_token                       | PASS   |       |
| test_router.py::test_refresh_sets_new_cookies                                   | PASS   |       |
| test_router.py::test_refresh_revokes_old_jti                                    | PASS   |       |
| test_router.py::test_refresh_returns_401_when_user_inactive                     | PASS   |       |
| test_router.py::test_refresh_returns_401_when_user_not_in_db                    | PASS   |       |
| test_router.py::test_refresh_returns_401_on_invalid_token                       | PASS   |       |
| test_router.py::test_logout_returns_200_with_cookie                             | PASS   |       |
| test_router.py::test_logout_returns_200_without_cookie                          | PASS   |       |
| test_router.py::test_logout_calls_block_token                                   | PASS   |       |
| test_router.py::test_logout_clears_access_token_cookie                          | PASS   |       |
| test_router.py::test_logout_handles_unparseable_token_gracefully                | PASS   |       |
| test_router.py::test_get_auth_role_returns_200_when_authenticated               | PASS   |       |
| test_router.py::test_get_auth_role_returns_user_data                            | PASS   |       |
| test_router.py::test_get_auth_role_returns_401_with_no_cookie                   | PASS   |       |
| test_router.py::test_get_auth_role_returns_401_with_invalid_token               | PASS   |       |
| test_router.py::test_get_auth_role_returns_401_when_token_blocklisted           | PASS   |       |
| test_router.py::test_get_auth_role_returns_401_when_user_inactive               | PASS   |       |
| test_token_blocklist.py::test_block_token_calls_setex_with_correct_key          | PASS   |       |
| test_token_blocklist.py::test_block_token_calls_setex_with_correct_ttl          | PASS   |       |
| test_token_blocklist.py::test_block_token_skips_when_ttl_zero                   | PASS   |       |
| test_token_blocklist.py::test_block_token_skips_when_ttl_negative               | PASS   |       |
| test_token_blocklist.py::test_block_token_skips_when_redis_unavailable          | PASS   |       |
| test_token_blocklist.py::test_block_token_fails_open_on_redis_exception         | PASS   |       |
| test_token_blocklist.py::test_is_token_blocked_returns_true_for_blocked_jti     | PASS   |       |
| test_token_blocklist.py::test_is_token_blocked_returns_false_for_unknown_jti    | PASS   |       |
| test_token_blocklist.py::test_is_token_blocked_checks_correct_key               | PASS   |       |
| test_token_blocklist.py::test_is_token_blocked_returns_false_when_redis_none    | PASS   |       |
| test_token_blocklist.py::test_is_token_blocked_fails_open_on_redis_exception    | PASS   |       |
| test_token_blocklist.py::test_get_redis_returns_none_when_use_redis_false       | PASS   |       |
| test_token_blocklist.py::test_get_redis_returns_none_when_redis_url_empty       | PASS   |       |
| test_token_blocklist.py::test_get_redis_returns_none_on_import_exception        | PASS   |       |


## Failures

None.

## Observations

- **87.4% overall coverage** exceeds the 80% minimum threshold.
- `auth0_management.py` has **0% coverage** — no tests exist for it yet. This is the Auth0 Management API client (user creation, role assignment). Tests should be added.
- All other modules are at 95%+ coverage, with `audit.py`, `dependencies.py`, `jwt.py`, and `jwt_utils.py` at 100%.
- 586 deprecation warnings present (likely from dependencies) — not blocking but worth investigating.


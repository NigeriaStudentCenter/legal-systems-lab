-- READ-ONLY CAPSTONE RELEASE CHECK. Run as the exact CPD runtime login
-- against the intended CPD database, after operator migration 003 and grants.
-- Do not paste connection strings or secrets into public issue reports.
WITH required(table_name) AS (
 VALUES ('cpd_users'),('cpd_course_sessions'),('cpd_enrolments'),
 ('cpd_capstone_submissions'),('cpd_capstone_decisions')
), checks AS (
 SELECT table_name,
        to_regclass('public.'||table_name) AS relation
 FROM required
), rights AS (
 SELECT table_name,relation,
  CASE WHEN relation IS NULL THEN false
       ELSE has_table_privilege(current_user,relation,'SELECT')
          AND has_table_privilege(current_user,relation,'INSERT')
          AND has_table_privilege(current_user,relation,'UPDATE')
          AND NOT has_table_privilege(current_user,relation,'DELETE')
          AND NOT has_table_privilege(current_user,relation,'TRUNCATE')
          AND NOT has_table_privilege(current_user,relation,'REFERENCES')
          AND NOT has_table_privilege(current_user,relation,'TRIGGER')
  END AS safe_grants,
  CASE WHEN relation IS NULL THEN false ELSE
    NOT EXISTS(SELECT 1 FROM pg_class WHERE oid=relation AND pg_get_userbyid(relowner)=current_user)
  END AS not_owner
 FROM checks
)
SELECT 'TABLE' AS check_type,table_name AS item,
 CASE WHEN relation IS NOT NULL AND safe_grants AND not_owner THEN 'PASS' ELSE 'FAIL' END AS result
FROM rights
UNION ALL
SELECT 'SCHEMA','public',
 CASE WHEN has_schema_privilege(current_user,'public','USAGE')
  AND NOT has_schema_privilege(current_user,'public','CREATE') THEN 'PASS' ELSE 'FAIL' END
UNION ALL
SELECT 'DATABASE',current_database(),
 CASE WHEN has_database_privilege(current_user,current_database(),'CONNECT')
  AND NOT has_database_privilege(current_user,current_database(),'CREATE')
  AND NOT has_database_privilege(current_user,current_database(),'TEMP') THEN 'PASS' ELSE 'FAIL' END
ORDER BY check_type,item;

-- 로컬 테스트용 employees 시딩 (H2 기준)
-- 재실행 안전: 동일 USER_ID가 있으면 update, 없으면 insert

MERGE INTO employees (user_id, active, role, site_id) KEY (user_id)
VALUES (1, TRUE, 'EMPLOYEE', 1);

MERGE INTO employees (user_id, active, role, site_id) KEY (user_id)
VALUES (2, TRUE, 'EMPLOYEE', 1);

MERGE INTO employees (user_id, active, role, site_id) KEY (user_id)
VALUES (3, TRUE, 'EMPLOYEE', 1);

MERGE INTO employees (user_id, active, role, site_id) KEY (user_id)
VALUES (4, TRUE, 'MANAGER', 1);

MERGE INTO employees (user_id, active, role, site_id) KEY (user_id)
VALUES (5, TRUE, 'ADMIN', 1);
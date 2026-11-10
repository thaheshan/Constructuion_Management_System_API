/**
 * Automated Verification Script for E-08: Roles API
 * Tests:
 *  1. GET /roles returns all 8 roles with scope and approval flags
 *  2. Each role selection (Owner -> Approved; Others -> Pending)
 *  3. Invalid role selection (throws 400 Bad Request)
 *  4. Unauthenticated call (throws 401 Unauthorized)
 */

import { RolesService } from '../src/modules/roles/roles.service';
import { RolesController } from '../src/modules/roles/roles.controller';
import { UsersRoleController } from '../src/modules/roles/users-role.controller';
import { BadRequestException, UnauthorizedException } from '@nestjs/common';

async function runTests() {
  console.log('\n================================================================');
  console.log('🧪 RUNNING E-08: ROLES API AUTOMATED TEST SUITE');
  console.log('================================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, testName: string, details?: string) {
    if (condition) {
      console.log(`  ✅ PASS: ${testName}`);
      passed++;
    } else {
      console.error(`  ❌ FAIL: ${testName}`);
      if (details) console.error(`     Details: ${details}`);
      failed++;
    }
  }

  // Mock Prisma
  const mockPrisma: any = {
    roleModel: {
      findMany: async () => [],
      upsert: async () => ({}),
    },
    user: {
      findUnique: async () => ({ id: 'usr-test-01', role: 'STAFF' }),
      update: async () => ({ id: 'usr-test-01' }),
    },
    userRole: {
      upsert: async () => ({}),
    },
  };

  const service = new RolesService(mockPrisma);
  const rolesController = new RolesController(service);
  const usersRoleController = new UsersRoleController(service);

  // ── TEST 1: GET /roles ─────────────────────────────────────────────────────
  console.log('▶ Testing: GET /roles');
  const roles = await rolesController.getRoles();

  assert(roles.length === 8, 'Returns exactly 8 roles', `Received ${roles.length}`);

  const expectedRoles = [
    { code: 'OWNER', scope: 'Company Wide', requiresApproval: false },
    { code: 'PROJECT_MANAGER', scope: 'Project Specific', requiresApproval: true },
    { code: 'SITE_SUPERVISOR', scope: 'Job Site', requiresApproval: true },
    { code: 'ARCHITECT', scope: 'Design Dept', requiresApproval: true },
    { code: 'LABOURER', scope: 'Field Works', requiresApproval: true },
    { code: 'ACCOUNTANT', scope: 'HQ Office', requiresApproval: true },
    { code: 'STORE_KEEPER', scope: 'Warehouse', requiresApproval: true },
    { code: 'STAFF', scope: 'HQ Office', requiresApproval: true },
  ];

  for (const expected of expectedRoles) {
    const found = roles.find((r) => r.code === expected.code);
    assert(
      !!found && found.scope === expected.scope && found.requiresApproval === expected.requiresApproval,
      `Role ${expected.code} has scope '${expected.scope}' and requiresApproval=${expected.requiresApproval}`,
    );
  }

  const staffRole = roles.find((r) => r.code === 'STAFF');
  assert(
    !!staffRole?.subRoles && staffRole.subRoles.length === 2,
    'Staff role has Support Operations and Workforce Administration sub-roles',
  );

  // ── TEST 2: PATCH /users/me/role (Each Role Selection) ─────────────────────
  console.log('\n▶ Testing: PATCH /users/me/role (Each Role Selection)');
  const authUser = { userId: 'usr-test-01', email: 'test@construction.lk', role: 'STAFF' };

  // 2.1 Owner
  const ownerResult = await usersRoleController.setMyRole(authUser, { role: 'OWNER' });
  assert(
    ownerResult.status === 'APPROVED' &&
      ownerResult.requiresApproval === false &&
      ownerResult.proceedToRegistration === true,
    'Owner selection -> status APPROVED & proceedToRegistration = true',
  );

  // 2.2 Non-Owner roles
  const nonOwnerRoles = [
    'PROJECT_MANAGER',
    'SITE_SUPERVISOR',
    'ARCHITECT',
    'LABOURER',
    'ACCOUNTANT',
    'STORE_KEEPER',
    'STAFF',
  ];

  for (const roleCode of nonOwnerRoles) {
    const result = await usersRoleController.setMyRole(authUser, {
      role: roleCode,
      ...(roleCode === 'STAFF' ? { subRole: 'Support Operations' } : {}),
    });
    assert(
      result.status === 'PENDING' &&
        result.requiresApproval === true &&
        result.proceedToRegistration === false,
      `Role ${roleCode} selection -> status PENDING & marked pending approval`,
    );
  }

  // ── TEST 3: Invalid Role Selection ─────────────────────────────────────────
  console.log('\n▶ Testing: Invalid Role Validation');
  let invalidRoleCaught = false;
  try {
    await usersRoleController.setMyRole(authUser, { role: 'SUPER_ADMIN_INVALID' });
  } catch (err: any) {
    invalidRoleCaught = err instanceof BadRequestException;
  }
  assert(invalidRoleCaught, 'Rejects invalid role with BadRequestException (400)');

  // ── TEST 4: Unauthenticated Call ───────────────────────────────────────────
  console.log('\n▶ Testing: Unauthenticated Call Rules');
  let unauthenticatedCaught = false;
  try {
    await usersRoleController.setMyRole(null as any, { role: 'OWNER' });
  } catch (err: any) {
    unauthenticatedCaught = err instanceof UnauthorizedException;
  }
  assert(unauthenticatedCaught, 'Rejects unauthenticated call with UnauthorizedException (401)');

  // ── SUMMARY ────────────────────────────────────────────────────────────────
  console.log('\n================================================================');
  console.log(`🏁 TEST RESULTS: ${passed} PASSED | ${failed} FAILED`);
  console.log('================================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error('Test suite runner error:', err);
  process.exit(1);
});

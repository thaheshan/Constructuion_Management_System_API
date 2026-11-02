export interface RoleDefinition {
  id: string;
  code: string;
  name: string;
  description: string;
  scope: string;
  tags: string[];
  requiresApproval: boolean;
  subRoles?: string[];
}

export const CMS_ROLES: RoleDefinition[] = [
  {
    id: 'role-owner',
    code: 'OWNER',
    name: 'Owner',
    description: 'Full legal and financial responsibility for the enterprise account.',
    scope: 'Company Wide',
    tags: ['BILLING', 'LEGAL', 'USERS'],
    requiresApproval: false,
  },
  {
    id: 'role-project-manager',
    code: 'PROJECT_MANAGER',
    name: 'Project Manager',
    description: 'Manages timelines, budgets, and overall project delivery metrics.',
    scope: 'Project Specific',
    tags: ['SCHEDULES', 'BUDGETING'],
    requiresApproval: true,
  },
  {
    id: 'role-site-supervisor',
    code: 'SITE_SUPERVISOR',
    name: 'Site Supervisor',
    description: 'Daily on-site operations management and safety compliance.',
    scope: 'Job Site',
    tags: ['SITE LOGS', 'SAFETY'],
    requiresApproval: true,
  },
  {
    id: 'role-architect',
    code: 'ARCHITECT',
    name: 'Architect',
    description: 'Design oversight, blueprint management, and technical compliance.',
    scope: 'Design Dept',
    tags: ['DRAWINGS', 'RFIS'],
    requiresApproval: true,
  },
  {
    id: 'role-labourer',
    code: 'LABOURER',
    name: 'Labourer',
    description: 'Direct site work, equipment handling, and task completion reporting.',
    scope: 'Field Works',
    tags: ['TASKS', 'TIMESHEETS'],
    requiresApproval: true,
  },
  {
    id: 'role-accountant',
    code: 'ACCOUNTANT',
    name: 'Accountant',
    description: 'Handling invoices, payroll, tax documentation, and financial audits.',
    scope: 'HQ Office',
    tags: ['INVOICES', 'PAYROLL'],
    requiresApproval: true,
  },
  {
    id: 'role-store-keeper',
    code: 'STORE_KEEPER',
    name: 'Store Keeper',
    description: 'Inventory management, materials receiving, and supply dispatch.',
    scope: 'Warehouse',
    tags: ['INVENTORY', 'LOGISTICS'],
    requiresApproval: true,
  },
  {
    id: 'role-staff',
    code: 'STAFF',
    name: 'Staff',
    description: 'Administrative and workforce support functions for the HQ.',
    scope: 'HQ Office',
    tags: [],
    requiresApproval: true,
    subRoles: ['Support Operations', 'Workforce Administration'],
  },
];

export const VALID_ROLE_CODES = CMS_ROLES.map((r) => r.code);

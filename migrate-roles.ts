import fs from 'fs';
import path from 'path';

const DB_PATH = path.join(process.cwd(), 'data', 'db.json');

function migrate() {
  console.log('[MIGRATION] Starting role-based access control migration...');
  
  if (!fs.existsSync(DB_PATH)) {
    console.log('[MIGRATION] Local db.json not found. Migration will skip local files.');
    return;
  }

  try {
    const rawData = fs.readFileSync(DB_PATH, 'utf-8');
    const db = JSON.parse(rawData);

    if (!db.users) {
      db.users = [];
    }

    let usersMigratedCount = 0;
    
    // 1. Ensure Quality Logistics Tenant exists in db.json
    if (!db.tenants) {
      db.tenants = [];
    }
    const qualityLogisticsTenant = db.tenants.find((t: any) => t.tenantId === 't-1');
    if (!qualityLogisticsTenant) {
      db.tenants.push({
        tenantId: 't-1',
        name: 'Quality Logistics',
        domain: 'qualitylogistics.com',
        planTier: 'Enterprise',
        status: 'active'
      });
      console.log('[MIGRATION] Quality Logistics tenant t-1 created successfully.');
    }

    // 2. Map and update users
    db.users = db.users.map((u: any) => {
      let changed = false;
      
      // Default tenant to t-1
      if (!u.tenantId) {
        u.tenantId = 't-1';
        changed = true;
      }

      if (u.email.toLowerCase() === 'armando.qualitylogistics@gmail.com') {
        if (u.tenantRole !== 'owner') {
          u.tenantRole = 'owner';
          changed = true;
        }
        if (u.platformRole !== 'superadmin') {
          u.platformRole = 'superadmin';
          changed = true;
        }
      } else {
        if (!u.tenantRole) {
          u.tenantRole = u.role === 'admin' ? 'admin' : 'operator';
          changed = true;
        }
        if (u.platformRole === undefined) {
          u.platformRole = null;
          changed = true;
        }
      }

      if (u.role !== undefined) {
        delete u.role;
        changed = true;
      }

      if (changed) {
        usersMigratedCount++;
      }
      return u;
    });

    fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2), 'utf-8');
    console.log(`[MIGRATION] Success! ${usersMigratedCount} user profiles updated with modern RBAC capabilities.`);
  } catch (error) {
    console.error('[MIGRATION ERROR] Failed to migrate user roles:', error);
  }
}

migrate();

# Database Seed Data Summary

## Overview

This document summarizes the demo data seeded for the Museumlite application using The Met Open Access API.

**Note**: This seed focuses on collections with real museum artwork from The Met. Workflow tables (loans, accessions, etc.) are not seeded.

## ✅ Tables with Demo Data

### Core Tables
- **organizations** - 5 demo organizations (National Museum of Natural History, Metropolitan Art Gallery, Heritage Library & Archives, Contemporary Design Museum, Vanderbilt Private Collection)
- **users** - Uses existing authenticated user
- **userOrganizations** - User assigned to all organizations as admin
- **roles** - Created via `createDefaultRoles` function
- **collections** - Best-effort ~50 objects per org with real Met artwork metadata
- **mediaFiles** - Real artwork images uploaded from The Met Open Access API

## ⚠️ Tables Without Demo Data

### Workflow Tables (Not Seeded)
- **loans**, **loanItems**, **loanDocuments** - No loan workflow data
- **accessions**, **deaccessions** - No accession workflow data
- **conditionReports** - No condition reports
- **locations**, **locationHistory** - No location tracking data
- **auditLog**, **notifications** - No activity/notification data

### Other Tables
- **conservationTreatments**, **exhibitions** - No treatment/exhibition data
- **workflowConfigs**, **webhooks**, **apiKeys**, **importJobs** - No configuration data

## 🎯 Functionality That Can Be Tested

With the seed data, you can test:

1. **Collections**
   - View collections with real museum artwork
   - See collection metadata (title, period, culture, materials, etc.)
   - View high-quality images from The Met

2. **Media Files**
   - View artwork images
   - Image gallery functionality

3. **Organizations**
   - Switch between 5 demo organizations
   - Different subscription tiers (free, pro, enterprise)

4. **Dashboard**
   - Collection counts and statistics

## 🚫 Functionality That Requires Manual Setup

1. **Workflow Features**
   - Loans, accessions, deaccessions
   - Condition reports
   - Location tracking

2. **Activity & Notifications**
   - Audit log entries
   - User notifications

3. **Integrations**
   - Webhooks, API keys
   - Import/export jobs

## 📝 Running the Seed Script

To seed the database with demo data:

```bash
cd packages/backend
npx convex run seedMetAction:resetAndSeed
```

**Requirements**:
- Authenticated user with email `mirzacmarius@gmail.com` must exist
- Convex dev server should be running or use production deployment

**Note**: The seed uses The Met Open Access API. Rate limiting may affect the number of objects created per organization. Any count > 0 per org is acceptable for demo purposes.

## 🔄 What the Seed Does

1. **Clears existing data** (preserves users and auth tables)
2. **Creates 5 organizations** with different types and subscription tiers
3. **Assigns user as admin** to all organizations
4. **Fetches artwork from The Met** using different search keywords per org
5. **Uploads images** to Convex storage
6. **Creates collection records** with real artwork metadata

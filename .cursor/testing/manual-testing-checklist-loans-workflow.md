# Manual Testing Checklist: Loans Workflow (MUS-94)

## Prerequisites

- ✅ Dev server running: `bun dev:app`
- ✅ Convex dev environment active
- ✅ Logged in with appropriate permissions (`loans.approve`, `loans.update`)
- ✅ Test organization with sample data

## Test Workflow: Complete Loan Lifecycle

### 1. Create a New Loan (Pending State)

- [X] Navigate to `/loans/new`
- [X] Fill in loan form (borrower, items, dates)
- [X] Submit loan
- [X] Verify loan appears in list with "Pending" status
- [X] Verify loan detail page shows "Pending" status
- [X] Verify "Approve Loan" and "Cancel Loan" buttons are visible

### 2. Approve Loan (Pending → Active)

- [X] Navigate to loan detail page (`/loans/[id]`)
- [X] Go to "Overview" tab
- [X] Click "Approve Loan" button
- [X] Verify status changes to "Active"
- [X] Verify "Dispatch Loan" and "Mark as Returned" buttons appear
- [X] Verify notification is sent (for other users in the organization, not the approver)
- [X] Verify loan appears in "Active" filter on loans list page

### 3. Dispatch Loan (Active → Dispatched)

- [X] On active loan detail page
- [X] Click "Dispatch Loan" button
- [X] Verify status changes to "Dispatched"
- [X] Verify only "Mark as Returned" button is visible
- [X] Verify notification is sent (for other users in the organization, not the dispatcher)
- [X] Verify loan appears in "Dispatched" filter on loans list page
- [X] Verify loan no longer appears in "Active" filter

### 4. Return Loan from Dispatched State

- [ ] On dispatched loan detail page
- [ ] Click "Mark as Returned" button
- [ ] Confirm in dialog
- [ ] Verify status changes to "Returned"
- [ ] Verify loan items status updated to "active"
- [ ] Verify notification is sent (for other users in the organization, not the returner)
- [ ] Verify loan appears in "Returned" filter

### 5. Return Loan from Active State (Skip Dispatch)

- [ ] Create new loan and approve it
- [ ] On active loan detail page
- [ ] Click "Mark as Returned" button (without dispatching)
- [ ] Confirm in dialog
- [ ] Verify status changes to "Returned"
- [ ] Verify this works correctly (no dispatch required)

### 6. Cancel Loan (Multiple States)

- [ ] **Cancel Pending Loan:**
  - [ ] Create pending loan
  - [ ] Click "Cancel Loan" button
  - [ ] Confirm cancellation
  - [ ] Verify status changes to "Cancelled"
  
- [ ] **Cancel Active Loan:**
  - [ ] Create and approve loan
  - [ ] Click "Cancel Loan" button (if available)
  - [ ] Verify cancellation works
  
- [ ] **Cancel Dispatched Loan:**
  - [ ] Create, approve, and dispatch loan
  - [ ] Verify cancellation option works

### 7. Edit Loan Restrictions

- [ ] Try to edit a pending loan → Should work
- [ ] Try to edit an active loan → Should show "Loan Locked" message
- [ ] Try to edit a dispatched loan → Should show "Loan Locked" message
- [ ] Try to edit a returned loan → Should show "Loan Locked" message

### 8. Filtering on Loans List

- [ ] Navigate to `/loans`
- [ ] Test each filter button:
  - [ ] "All" shows all loans
  - [ ] "Pending" shows only pending loans
  - [ ] "Active" shows only active loans
  - [ ] "Dispatched" shows only dispatched loans (NEW)
  - [ ] "Returned" shows only returned loans
  - [ ] "Cancelled" shows only cancelled loans

### 9. Permission Checks

- [ ] Test with user lacking `loans.approve` permission:
  - [ ] "Approve Loan" button should not be visible
- [ ] Test with user lacking `loans.update` permission:
  - [ ] "Dispatch", "Return", "Cancel" buttons should not be visible

### 10. Error Handling

- [ ] Try to approve already-approved loan → Should show error
- [ ] Try to dispatch non-active loan → Should show error
- [ ] Try to return already-returned loan → Should show error
- [ ] Verify error messages are user-friendly

## Quick Test Script (Copy-paste to terminal)

```bash
# 1. Start dev server
bun dev:app

# 2. In browser console (on loan detail page), test mutations:
# (These are just for reference - actual testing should be done via UI)

# Check current loan status
console.log("Current status:", loan.status);

# After each action, verify:
# - Status updated correctly
# - UI buttons changed appropriately
# - Notification appeared
# - Audit log entry created
```

## Expected Results Summary

✅ **All Status Transitions Work:**

- pending → active (via approve)
- active → dispatched (via dispatch)
- active → returned (via return, skipping dispatch)
- dispatched → returned (via return)
- pending/active/dispatched → cancelled (via cancel)

✅ **UI Updates Correctly:**

- Buttons appear/disappear based on status
- Status badges show correct state
- Filters work correctly

✅ **Backend Validations:**

- Cannot perform invalid transitions
- Permissions enforced
- Audit logs created
- Notifications sent

---

**Note:** If any step fails, note the error message and current state for debugging.

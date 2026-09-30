"use client";

import type { Doc } from "@v1/backend/convex/_generated/dataModel";
import { Building2, Mail, MapPin, Phone, User, UserCog } from "lucide-react";

interface AccountDetailInfoProps {
  account: Doc<"accounts">;
}

export function AccountDetailInfo({ account }: AccountDetailInfoProps) {
  return (
    <div className="rounded-lg border border-border bg-card p-6">
      <h2 className="mb-6 text-lg font-medium">Account Information</h2>
      <div className="grid gap-6 md:grid-cols-2">
        <div className="space-y-4">
          <div>
            <h3 className="mb-4 text-sm font-medium text-muted-foreground">
              Business Information
            </h3>
            <div className="space-y-3">
              <div className="flex items-start gap-3">
                <Building2 className="mt-0.5 size-4 text-muted-foreground" />
                <div>
                  <p className="text-sm font-medium">{account.businessName}</p>
                  <p className="text-xs text-muted-foreground">Business Name</p>
                </div>
              </div>
              {account.phone && (
                <div className="flex items-start gap-3">
                  <Phone className="mt-0.5 size-4 text-muted-foreground" />
                  <div>
                    <p className="text-sm">{account.phone}</p>
                    <p className="text-xs text-muted-foreground">Phone</p>
                  </div>
                </div>
              )}
              {account.email && (
                <div className="flex items-start gap-3">
                  <Mail className="mt-0.5 size-4 text-muted-foreground" />
                  <div>
                    <p className="text-sm">{account.email}</p>
                    <p className="text-xs text-muted-foreground">Email</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {(account.address ||
          account.address2 ||
          account.city ||
          account.zipCode ||
          account.country) && (
          <div className="space-y-4">
            <div>
              <h3 className="mb-4 text-sm font-medium text-muted-foreground">
                Address
              </h3>
              <div className="flex items-start gap-3">
                <MapPin className="mt-0.5 size-4 text-muted-foreground" />
                <div className="space-y-1">
                  {account.address && (
                    <p className="text-sm">{account.address}</p>
                  )}
                  {account.address2 && (
                    <p className="text-sm">{account.address2}</p>
                  )}
                  {(account.city || account.zipCode) && (
                    <p className="text-sm">
                      {[account.city, account.zipCode]
                        .filter(Boolean)
                        .join(", ")}
                    </p>
                  )}
                  {account.country && (
                    <p className="text-sm">{account.country}</p>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {(account.contactPerson ||
          account.contactPhone ||
          account.contactEmail) && (
          <div className="space-y-4">
            <div>
              <h3 className="mb-4 text-sm font-medium text-muted-foreground">
                Contact Person
              </h3>
              <div className="space-y-3">
                {account.contactPerson && (
                  <div className="flex items-start gap-3">
                    <User className="mt-0.5 size-4 text-muted-foreground" />
                    <div>
                      <p className="text-sm">{account.contactPerson}</p>
                      <p className="text-xs text-muted-foreground">
                        Contact Name
                      </p>
                    </div>
                  </div>
                )}
                {account.contactPhone && (
                  <div className="flex items-start gap-3">
                    <Phone className="mt-0.5 size-4 text-muted-foreground" />
                    <div>
                      <p className="text-sm">{account.contactPhone}</p>
                      <p className="text-xs text-muted-foreground">
                        Contact Phone
                      </p>
                    </div>
                  </div>
                )}
                {account.contactEmail && (
                  <div className="flex items-start gap-3">
                    <Mail className="mt-0.5 size-4 text-muted-foreground" />
                    <div>
                      <p className="text-sm">{account.contactEmail}</p>
                      <p className="text-xs text-muted-foreground">
                        Contact Email
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {account.notes && (
          <div className="space-y-4 md:col-span-2">
            <div>
              <h3 className="mb-4 text-sm font-medium text-muted-foreground">
                Notes
              </h3>
              <p className="text-sm whitespace-pre-wrap">{account.notes}</p>
            </div>
          </div>
        )}

        {account.accountType && (
          <div className="space-y-4">
            <div>
              <h3 className="mb-4 text-sm font-medium text-muted-foreground flex items-center gap-2">
                <UserCog className="size-4" />
                Account Type
              </h3>
              <div className="flex items-start gap-3">
                <div className="mt-0.5">
                  <span className="inline-flex items-center rounded-full bg-primary/10 px-3 py-1 text-sm font-medium text-primary capitalize">
                    {account.accountType}
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

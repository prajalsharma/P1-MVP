import Link from "next/link";
import type { Profile } from "@/types/database.types";
import { LogoutButton } from "@/components/auth/LogoutButton";
import styles from "./DashboardLayout.module.css";

type ActiveNav = "vault" | "affiliations" | "registry" | "bulk";

interface DashboardLayoutProps {
  profile: Profile;
  children: React.ReactNode;
  activeNav?: ActiveNav;
}

const PAGE_TITLES: Record<ActiveNav, string> = {
  vault: "Vault",
  affiliations: "Affiliations",
  registry: "Organisation registry",
  bulk: "Bulk verification",
};

export function DashboardLayout({ profile, children, activeNav = "vault" }: DashboardLayoutProps) {
  const vaultLocked = !profile.is_public;
  const isOrgAdmin = profile.role === "ORG_ADMIN";

  return (
    <div className={styles.shell}>
      {/* Sidebar */}
      <aside className={styles.sidebar}>
        <div className={styles.wordmark}>
          <span className={styles.wordmarkDot} />
          <span className={styles.wordmarkText}>Arkova</span>
        </div>

        <nav className={styles.nav}>
          <Link
            href="/vault"
            className={styles.navItem}
            data-active={activeNav === "vault" ? "true" : undefined}
          >
            <span className={styles.navIcon}>
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                <rect x="2" y="2" width="12" height="12" rx="2" stroke="currentColor" strokeWidth="1.5" />
                <path d="M5 8h6M8 5v6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
            </span>
            Vault
          </Link>

          <Link
            href="/affiliations"
            className={styles.navItem}
            data-active={activeNav === "affiliations" ? "true" : undefined}
          >
            <span className={styles.navIcon}>
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                <circle cx="8" cy="5" r="2.5" stroke="currentColor" strokeWidth="1.5" />
                <path d="M2 13c0-2.21 2.686-4 6-4s6 1.79 6 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
            </span>
            Affiliations
          </Link>

          {isOrgAdmin && (
              <Link
                href="/org/registry"
                className={styles.navItem}
                data-active={activeNav === "registry" ? "true" : undefined}
              >
                <span className={styles.navIcon}>
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                    <rect x="2" y="3" width="12" height="10" rx="2" stroke="currentColor" strokeWidth="1.5" />
                    <path d="M5 7h6M5 10h4" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" />
                  </svg>
                </span>
                Registry
              </Link>
            )}

            {isOrgAdmin && (
              <Link
                href="/org/bulk"
                className={styles.navItem}
                data-active={activeNav === "bulk" ? "true" : undefined}
              >
                <span className={styles.navIcon}>
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                    <path d="M3 4h10M3 8h10M3 12h6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                    <circle cx="13" cy="12" r="2.25" stroke="currentColor" strokeWidth="1.25" />
                    <path d="M13 10.75v1.25l.75.75" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </span>
                Bulk
              </Link>
            )}
        </nav>

        <div className={styles.sidebarFooter}>
          <p className={styles.footerEmail}>{profile.email}</p>
        </div>
      </aside>

      {/* Main content area */}
      <div className={styles.main}>
        {/* Header */}
        <header className={styles.header}>
          <div className={styles.headerLeft}>
            <h1 className={styles.headerTitle}>{PAGE_TITLES[activeNav]}</h1>
            {activeNav === "vault" && vaultLocked && (
              <span className={styles.vaultLockedBadge} role="status" aria-label="Vault is private">
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
                  <rect x="2" y="5.5" width="8" height="5" rx="1" stroke="currentColor" strokeWidth="1.25" />
                  <path d="M4 5.5V4a2 2 0 014 0v1.5" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" />
                </svg>
                Vault Locked
              </span>
            )}
          </div>
          <LogoutButton />
        </header>

        {/* Page content */}
        <div className={styles.content}>{children}</div>
      </div>
    </div>
  );
}

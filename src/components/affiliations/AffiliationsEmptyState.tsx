import styles from "./AffiliationsEmptyState.module.css";

export function AffiliationsEmptyState() {
  return (
    <div className={styles.wrapper}>
      <div className={styles.iconWrap}>
        <svg
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          aria-hidden="true"
        >
          <circle cx="12" cy="8" r="3.5" stroke="currentColor" strokeWidth="1.5" />
          <path
            d="M4 20c0-3.314 3.582-6 8-6s8 2.686 8 6"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
        </svg>
      </div>
      <h3 className={styles.heading}>Affiliations — Coming soon</h3>
      <p className={styles.body}>
        Organization relationships and verified affiliations will appear here
        once this feature is available.
      </p>
    </div>
  );
}

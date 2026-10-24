/**
 * Length caps for the public marketing forms. The marketing site's inputs use
 * the same numbers, so a visitor never types more than the backend accepts.
 */
export const TOUR_REQUEST_FIELD_MAX_LENGTH = {
  name: 200,
  institution: 200,
  email: 254,
  collectionSize: 100,
  message: 5000,
} as const;

export const NEWSLETTER_USER_GROUP_MAX_LENGTH = 64;

const EMAIL_ADDRESS = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** A plausible address no longer than a mailbox allows. */
export function isEmailAddress(email: string): boolean {
  return (
    email.length <= TOUR_REQUEST_FIELD_MAX_LENGTH.email &&
    EMAIL_ADDRESS.test(email)
  );
}

export {
  extractWords,
  firstWords,
  mainOpensWithSegments,
  openingFingerprint,
} from './extract';
export { normalizePageRef, PAGE_REF_RE, type ParsedPageRef, parsePageRef } from './page-ref';
export {
  amudPairDistinct,
  type DafIdentityInput,
  type DafIdentityIssue,
  type DafIdentityResult,
  verifyDafIdentity,
} from './verify';

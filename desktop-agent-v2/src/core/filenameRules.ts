import path from 'path';

export type FilenameValidation = {
  status: 'ok' | 'minor' | 'major';
  issues: string[];
};

export function validateFilename(filename: string): FilenameValidation {
  const issues: string[] = [];

  const ext = path.extname(filename);
  const base = path.basename(filename, ext);

  if (!ext) {
    issues.push('MISSING_EXTENSION');
  }

  if (filename.includes(' ')) {
    issues.push('HAS_SPACES');
  }

  const parts = base.split('_').filter(Boolean);

  if (parts.length < 4) {
    issues.push('MISSING_FIELDS');
  }

  // Expected: FULLNAME (can be multiple parts) + AGE + CONDITION + REGION
  // We take last 3 as age/condition/region.
  const agePart = parts.length >= 3 ? parts[parts.length - 3] : null;
  const condPart = parts.length >= 2 ? parts[parts.length - 2] : null;
  const regionPart = parts.length >= 1 ? parts[parts.length - 1] : null;
  const nameParts = parts.length >= 4 ? parts.slice(0, parts.length - 3) : [];

  if (nameParts.length === 0) issues.push('MISSING_NAME');

  if (!agePart) {
    issues.push('MISSING_AGE');
  } else if (!/^\d+$/.test(agePart)) {
    issues.push('AGE_NOT_NUMERIC');
  }

  if (!condPart) issues.push('MISSING_CONDITION');
  if (!regionPart) issues.push('MISSING_REGION');

  // severity
  const majorKeys = new Set(['MISSING_FIELDS', 'MISSING_NAME', 'MISSING_AGE', 'MISSING_CONDITION', 'MISSING_REGION']);
  const minorKeys = new Set(['HAS_SPACES', 'AGE_NOT_NUMERIC', 'MISSING_EXTENSION']);

  const major = issues.some(i => majorKeys.has(i));
  const minor = !major && issues.some(i => minorKeys.has(i));

  if (major) return { status: 'major', issues };
  if (minor) return { status: 'minor', issues };
  return { status: 'ok', issues: [] };
}

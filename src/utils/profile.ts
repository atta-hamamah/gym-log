/** The AI coach needs date of birth and gender; everything else is optional. */
export function isProfileComplete(
  profile: { dateOfBirth?: string; gender?: string } | null | undefined
): boolean {
  return !!profile?.dateOfBirth && !!profile?.gender;
}

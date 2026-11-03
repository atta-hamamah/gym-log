/**
 * Template text for nudges scheduled on the phone (no AI): each coach has a
 * couple of lines per nudge kind in every language (locales: "nudges").
 */
import i18n from '../i18n';
import { getMuscleGroupName } from '../constants/exercises';
import type { Coach, Nudge } from './nudges';

/** `formatVolume`: kg → text in the user's units, e.g. "12,400 kg". */
export function renderNudge(nudge: Nudge, coach: Coach, formatVolume: (kg: number) => string): { title: string; body: string } {
  const t = i18n.t.bind(i18n);
  // Alternate between the lines so the same nudge doesn't repeat word for word.
  const variant = (nudge.day % 2) + 1;
  const body = t(`nudges.${nudge.kind}.${coach}.${variant}`, {
    session: nudge.session ?? '',
    group: nudge.group ? getMuscleGroupName(nudge.group, t) : '',
    days: t('nudges.daysCount', { count: nudge.days ?? 0 }),
    workouts: t('nudges.workoutsCount', { count: nudge.workouts ?? 0 }),
    sets: t('nudges.setsCount', { count: nudge.sets ?? 0 }),
    volume: formatVolume(nudge.volumeKg ?? 0),
  });
  return { title: t(`nudges.coachName.${coach}`), body };
}

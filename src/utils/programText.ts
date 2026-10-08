import type { TFunction } from 'i18next';
import { WorkoutProgram } from '../types';

// Built-in programs are written in English in constants/programs.ts; translations live under
// `programContent.<programId>` in the locale files, with the English text as the fallback.

export const programName = (program: WorkoutProgram, t: TFunction): string =>
    t(`programContent.${program.id}.name`, { defaultValue: program.name });

export const programDescription = (program: WorkoutProgram, t: TFunction): string =>
    t(`programContent.${program.id}.description`, { defaultValue: program.description });

export const programDayName = (program: WorkoutProgram, dayIndex: number, t: TFunction): string =>
    t(`programContent.${program.id}.days.${dayIndex}`, { defaultValue: program.days[dayIndex]?.name ?? '' });

/** "Ongoing", "8 weeks" and "4-week cycles" in the current language; anything else is shown as written. */
export function programDuration(duration: string, t: TFunction): string {
    if (duration === 'Ongoing') return t('programs.durationOngoing', { defaultValue: duration });
    const weeks = duration.match(/^(\d+) weeks?$/);
    if (weeks) return t('programs.durationWeeks', { count: Number(weeks[1]), defaultValue: duration });
    const cycles = duration.match(/^(\d+)-week cycles?$/);
    if (cycles) return t('programs.durationCycles', { count: Number(cycles[1]), defaultValue: duration });
    return duration;
}

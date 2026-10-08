import React from 'react';
import { I18nManager } from 'react-native';
import { ArrowLeft, ArrowRight, ChevronLeft, ChevronRight, LucideProps, SkipBack, SkipForward } from 'lucide-react-native';

// Icons that point "forward" or "back" swap to their mirror image in RTL layouts (Arabic).

/** Row disclosure chevron: points toward the reading direction's end. */
export const ForwardChevron = (props: LucideProps) =>
    I18nManager.isRTL ? <ChevronLeft {...props} /> : <ChevronRight {...props} />;

/** Back button arrow. */
export const BackArrow = (props: LucideProps) =>
    I18nManager.isRTL ? <ArrowRight {...props} /> : <ArrowLeft {...props} />;

/** Skip-ahead icon. */
export const SkipAhead = (props: LucideProps) =>
    I18nManager.isRTL ? <SkipBack {...props} /> : <SkipForward {...props} />;

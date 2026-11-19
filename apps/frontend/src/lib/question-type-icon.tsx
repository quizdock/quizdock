import { QUESTION_TYPE_INFO, type QuestionTypeName } from '@quiz-dock/contracts';
import {
  ArrowDownWideNarrow,
  BarChart3,
  CheckCheck,
  CircleDot,
  CircleHelp,
  Hash,
  LayoutGrid,
  type LucideIcon,
  type LucideProps,
  SquareCheck,
  TextCursorInput,
} from 'lucide-react';

/** The Lucide icons the question types' reference names (QUESTION_TYPE_INFO). */
const ICONS: Record<string, LucideIcon> = {
  'circle-dot': CircleDot,
  'square-check': SquareCheck,
  'check-check': CheckCheck,
  'text-cursor-input': TextCursorInput,
  hash: Hash,
  'arrow-down-wide-narrow': ArrowDownWideNarrow,
  'bar-chart-3': BarChart3,
  'layout-grid': LayoutGrid,
};

/** A question type's icon, as its reference names it. */
export function QuestionTypeIcon({ type, ...props }: { type: string } & LucideProps) {
  const Icon = ICONS[QUESTION_TYPE_INFO[type as QuestionTypeName]?.icon] ?? CircleHelp;
  return <Icon {...props} />;
}

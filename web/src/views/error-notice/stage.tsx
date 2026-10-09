import type { Harness } from '../types';
import {
  Banner,
  FieldError,
  Inline,
  Settings,
  ToastAndDialog,
} from './mockups';

const STATES = {
  inline: Inline,
  banner: Banner,
  toast: ToastAndDialog,
  field: FieldError,
  settings: Settings,
};

/** One error-notice mockup, chosen by the scenario's `state`. */
export function ErrorNoticeStage({ harness }: { harness: Harness }) {
  const State = STATES[harness.props.state as keyof typeof STATES];
  return (
    <div className="p-card">
      <State />
    </div>
  );
}

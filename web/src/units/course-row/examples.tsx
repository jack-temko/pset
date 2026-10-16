import { defineExamples } from '@/design/examples';
import { HomeLists } from '@/units/assignment-row/home';
import { CourseRow } from './index';
import spec from './spec';

/** A fixed Tuesday noon, as on the assignment row's page. */
const TODAY = new Date(2026, 9, 13, 12);
const ago = (hours: number) => new Date(TODAY.getTime() - hours * 3_600_000);

export default defineExamples(spec, {
  states: {
    'to-do': () => (
      <CourseRow
        name="Circuits I"
        href="#"
        todo={3}
        materials={7}
        openedAt={ago(26)}
        weekMinutes={130}
        today={TODAY}
      />
    ),
    one: () => (
      <CourseRow
        name="Differential equations"
        href="#"
        todo={1}
        materials={1}
        openedAt={ago(2)}
        weekMinutes={45}
        today={TODAY}
      />
    ),
    none: () => (
      <CourseRow
        name="Linear algebra"
        href="#"
        todo={0}
        materials={0}
        openedAt={ago(24 * 12)}
        weekMinutes={0}
        today={TODAY}
      />
    ),
    'never-opened': () => (
      <CourseRow
        name="Thermodynamics"
        href="#"
        todo={4}
        materials={12}
        weekMinutes={0}
        today={TODAY}
      />
    ),
    list: () => <HomeLists />,
  },
  stress: () => (
    <div className="w-[320px] max-w-full outline-[1px] outline-dashed outline-(--ds-border-muted)">
      <CourseRow
        name="Electromagnetics and the physics of electrical machines, second year, spring term"
        href="#"
        todo={12}
        materials={31}
        openedAt={ago(5)}
        weekMinutes={190}
        today={TODAY}
      />
    </div>
  ),
});

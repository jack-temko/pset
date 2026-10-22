import { defineExamples } from '@/design/examples';
import { HomeLists } from '@/units/assignment-row/home';
import { CourseRow } from './index';
import spec from './spec';

export default defineExamples(spec, CourseRow, {
  states: {
    'to-do': () => (
      <CourseRow
        name="Circuits I"
        href="#"
        todo={3}
        materials={7}
        weekMinutes={130}
      />
    ),
    one: () => (
      <CourseRow
        name="Differential equations"
        href="#"
        todo={1}
        materials={1}
        weekMinutes={45}
      />
    ),
    none: () => (
      <CourseRow
        name="Linear algebra"
        href="#"
        todo={0}
        materials={0}
        weekMinutes={0}
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
        weekMinutes={190}
      />
    </div>
  ),
});

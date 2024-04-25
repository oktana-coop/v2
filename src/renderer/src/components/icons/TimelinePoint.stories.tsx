import type { Meta, StoryObj } from '@storybook/react';
import type { ComponentProps } from 'react';

import { TimelinePoint } from './TimelinePoint';

const meta: Meta<typeof TimelinePoint> = {
  title: 'icons/TimelinePoint',
  component: TimelinePoint,
  parameters: {
    layout: 'centered',
  },
};

export default meta;

type Story = StoryObj<ComponentProps<typeof TimelinePoint>>;

export const Simple: Story = {
  args: {
    color: 'purple',
  },
};

export const Timeline: Story = {
  render: () => (
    <div>
      <div
        className="flex flex-row items-center"
        style={{
          width: 500,
          backgroundColor: 'white',
        }}
      >
        <div
          className="flex flex-row items-center"
          style={{
            width: 50,
            height: '100%',
            backgroundColor: 'white',
          }}
        >
          <TimelinePoint
            circleSize={12.5}
            circleStrokeSize={5}
            circleFillColor="transparent"
            hasTopStem={false}
          />
        </div>
        Uncommited changes
      </div>
      <div
        className="flex flex-row items-center"
        style={{
          width: 500,
          backgroundColor: 'white',
        }}
      >
        <div
          className="flex flex-row items-center"
          style={{
            width: 50,
            height: '100%',
            backgroundColor: 'white',
          }}
        >
          <TimelinePoint color="purple-500" />
        </div>
        Some message 1
      </div>
      <div
        className="flex flex-row items-center"
        style={{
          width: 500,
          backgroundColor: 'white',
        }}
      >
        <div
          className="flex flex-row items-center"
          style={{
            width: 50,
            height: '100%',
            backgroundColor: 'white',
          }}
        >
          <TimelinePoint color="#f00" />
        </div>
        Some message 2
      </div>
      <div
        className="flex flex-row items-center"
        style={{
          width: 500,
          backgroundColor: 'white',
        }}
      >
        <div
          className="flex flex-row items-center"
          style={{
            width: 50,
            height: '100%',
            backgroundColor: 'white',
          }}
        >
          <TimelinePoint color="purple" hasBottomStem={false} />
        </div>
        Some message 3
      </div>
    </div>
  ),
};

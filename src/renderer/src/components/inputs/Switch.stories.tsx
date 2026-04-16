import type { Meta, StoryObj } from '@storybook/react';
import type { ComponentProps } from 'react';
import { useState } from 'react';

import { Label } from './Fieldset';
import { Switch, SwitchField, SwitchGroup } from './Switch';

const meta: Meta<typeof Switch> = {
  title: 'inputs/Switch',
  component: Switch,
  parameters: {
    layout: 'centered',
  },
};

type Story = StoryObj<ComponentProps<typeof Switch>>;

export const Default: Story = {
  render: () => {
    const [enabled, setEnabled] = useState(false);
    return (
      <SwitchField>
        <Label>Notifications</Label>
        <Switch checked={enabled} onChange={setEnabled} />
      </SwitchField>
    );
  },
};

export const Purple: Story = {
  render: () => {
    const [enabled, setEnabled] = useState(true);
    return (
      <SwitchField>
        <Label>Page Numbers</Label>
        <Switch checked={enabled} onChange={setEnabled} color="purple" />
      </SwitchField>
    );
  },
};

export const Group: Story = {
  render: () => {
    const [a, setA] = useState(true);
    const [b, setB] = useState(false);
    return (
      <SwitchGroup>
        <SwitchField>
          <Label>Option A</Label>
          <Switch checked={a} onChange={setA} color="purple" />
        </SwitchField>
        <SwitchField>
          <Label>Option B</Label>
          <Switch checked={b} onChange={setB} color="purple" />
        </SwitchField>
      </SwitchGroup>
    );
  },
};

export const Disabled: Story = {
  render: () => (
    <SwitchField>
      <Label>Disabled</Label>
      <Switch checked={false} onChange={() => {}} disabled />
    </SwitchField>
  ),
};

export default meta;

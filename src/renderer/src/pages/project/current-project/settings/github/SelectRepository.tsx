import {
  Listbox,
  ListboxLabel,
  ListboxOption,
} from '../../../../../components/inputs/Listbox';

const repositories = [{ name: 'foo' }];

export const SelectRepository = () => {
  return (
    <div className="max-w-64">
      <Listbox
        placeholder="Select GitHub repository&hellip;"
        name="github-repository-select"
      >
        {repositories.map(({ name }) => (
          <ListboxOption key={name} value={name} className="max-w-2xl">
            <ListboxLabel>{name}</ListboxLabel>
          </ListboxOption>
        ))}
      </Listbox>
    </div>
  );
};

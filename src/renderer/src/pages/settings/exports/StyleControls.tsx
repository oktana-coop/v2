import {
  type ExportTemplate,
  type ExportTemplateStyles,
  type PageSetup,
} from '../../../../../modules/personalization/export-templates';
import { ExpansionPanel } from '../../../components/layout/ExpansionPanel';
import { BaseBlockStyleEditor } from './BaseBlockStyleEditor';
import { BlockquoteStyleEditor } from './BlockquoteStyleEditor';
import { BulletListStyleEditor } from './BulletListStyleEditor';
import { CodeBlockStyleEditor } from './CodeBlockStyleEditor';
import { HorizontalRuleStyleEditor } from './HorizontalRuleStyleEditor';
import { InlineCodeStyleEditor } from './InlineCodeStyleEditor';
import { LinkStyleEditor } from './LinkStyleEditor';
import { OrderedListStyleEditor } from './OrderedListStyleEditor';
import { PageSetupEditor } from './PageSetupEditor';
import { ParagraphStyleEditor } from './ParagraphStyleEditor';

type StyleControlsProps = {
  template: ExportTemplate;
  onChange: (template: ExportTemplate) => void;
};

const updateStyles = (
  template: ExportTemplate,
  patch: Partial<ExportTemplateStyles>
): ExportTemplate => ({
  ...template,
  styles: { ...template.styles, ...patch },
});

export const StyleControls = ({ template, onChange }: StyleControlsProps) => {
  const { styles } = template;

  return (
    <div className="flex flex-col overflow-y-auto">
      <h3 className="text-left text-lg font-semibold text-zinc-900 dark:text-zinc-100">
        Page Setup
      </h3>
      <div className="py-3">
        <PageSetupEditor
          pageSetup={template.pageSetup}
          onChange={(pageSetup: PageSetup) =>
            onChange({ ...template, pageSetup })
          }
        />
      </div>

      <h3 className="mt-6 text-left text-lg font-semibold text-zinc-900 dark:text-zinc-100">
        Blocks
      </h3>
      <div className="divide-y divide-zinc-200 dark:divide-zinc-700">
        <ExpansionPanel title="Paragraph" defaultOpen>
          <ParagraphStyleEditor
            style={styles.paragraph}
            onChange={(paragraph) =>
              onChange(updateStyles(template, { paragraph }))
            }
          />
        </ExpansionPanel>
        <ExpansionPanel title="Heading 1">
          <BaseBlockStyleEditor
            style={styles.heading1}
            onChange={(heading1) =>
              onChange(updateStyles(template, { heading1 }))
            }
          />
        </ExpansionPanel>
        <ExpansionPanel title="Heading 2">
          <BaseBlockStyleEditor
            style={styles.heading2}
            onChange={(heading2) =>
              onChange(updateStyles(template, { heading2 }))
            }
          />
        </ExpansionPanel>
        <ExpansionPanel title="Heading 3">
          <BaseBlockStyleEditor
            style={styles.heading3}
            onChange={(heading3) =>
              onChange(updateStyles(template, { heading3 }))
            }
          />
        </ExpansionPanel>
        <ExpansionPanel title="Heading 4">
          <BaseBlockStyleEditor
            style={styles.heading4}
            onChange={(heading4) =>
              onChange(updateStyles(template, { heading4 }))
            }
          />
        </ExpansionPanel>
        <ExpansionPanel title="Heading 5">
          <BaseBlockStyleEditor
            style={styles.heading5}
            onChange={(heading5) =>
              onChange(updateStyles(template, { heading5 }))
            }
          />
        </ExpansionPanel>
        <ExpansionPanel title="Heading 6">
          <BaseBlockStyleEditor
            style={styles.heading6}
            onChange={(heading6) =>
              onChange(updateStyles(template, { heading6 }))
            }
          />
        </ExpansionPanel>
        <ExpansionPanel title="Code Block">
          <CodeBlockStyleEditor
            style={styles.codeBlock}
            onChange={(codeBlock) =>
              onChange(updateStyles(template, { codeBlock }))
            }
          />
        </ExpansionPanel>
        <ExpansionPanel title="Horizontal Rule">
          <HorizontalRuleStyleEditor
            style={styles.horizontalRule}
            onChange={(horizontalRule) =>
              onChange(updateStyles(template, { horizontalRule }))
            }
          />
        </ExpansionPanel>
      </div>

      <h3 className="mt-6 text-left text-lg font-semibold text-zinc-900 dark:text-zinc-100">
        Containers
      </h3>
      <div className="divide-y divide-zinc-200 dark:divide-zinc-700">
        <ExpansionPanel title="Unordered List">
          <BulletListStyleEditor
            style={styles.unorderedList}
            onChange={(unorderedList) =>
              onChange(updateStyles(template, { unorderedList }))
            }
          />
        </ExpansionPanel>
        <ExpansionPanel title="Ordered List">
          <OrderedListStyleEditor
            style={styles.orderedList}
            onChange={(orderedList) =>
              onChange(updateStyles(template, { orderedList }))
            }
          />
        </ExpansionPanel>
        <ExpansionPanel title="Blockquote">
          <BlockquoteStyleEditor
            style={styles.blockquote}
            onChange={(blockquote) =>
              onChange(updateStyles(template, { blockquote }))
            }
          />
        </ExpansionPanel>
      </div>

      <h3 className="mt-6 text-left text-lg font-semibold text-zinc-900 dark:text-zinc-100">
        Marks
      </h3>
      <div className="divide-y divide-zinc-200 dark:divide-zinc-700">
        <ExpansionPanel title="Link">
          <LinkStyleEditor
            style={styles.link}
            onChange={(link) => onChange(updateStyles(template, { link }))}
          />
        </ExpansionPanel>
        <ExpansionPanel title="Inline Code">
          <InlineCodeStyleEditor
            style={styles.inlineCode}
            onChange={(inlineCode) =>
              onChange(updateStyles(template, { inlineCode }))
            }
          />
        </ExpansionPanel>
      </div>
    </div>
  );
};

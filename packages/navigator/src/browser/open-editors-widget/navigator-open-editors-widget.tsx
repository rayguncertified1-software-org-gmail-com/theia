/********************************************************************************
 * Copyright (C) 2021 Ericsson and others.
 *
 * This program and the accompanying materials are made available under the
 * terms of the Eclipse Public License v. 2.0 which is available at
 * http://www.eclipse.org/legal/epl-2.0.
 *
 * This Source Code may also be made available under the following Secondary
 * Licenses when the conditions for such availability set forth in the Eclipse
 * Public License v. 2.0 are satisfied: GNU General Public License, version 2
 * with the GNU Classpath Exception which is available at
 * https://www.gnu.org/software/classpath/license.html.
 *
 * SPDX-License-Identifier: EPL-2.0 OR GPL-2.0 WITH Classpath-exception-2.0
 ********************************************************************************/

import * as React from 'react';
import { injectable, interfaces, Container, postConstruct, inject } from 'inversify';
import {
    ApplicationShell,
    ContextMenuRenderer,
    defaultTreeProps,
    NodeProps,
    TreeDecoratorService,
    TreeModel,
    TreeNode,
    TreeProps,
    TREE_NODE_CONTENT_CLASS,
} from '@theia/core/lib/browser';
import { OpenEditorNode, OpenEditorsModel } from './navigator-open-editors-tree-model';
import { createFileTreeContainer, FileTreeModel, FileTreeWidget } from '@theia/filesystem/lib/browser';
import { OpenEditorsTreeDecoratorService } from './navigator-open-editors-decorator-service';
import { OpenEditorTreeDecorationData } from './navigator-open-editors-file-decorator';
import { notEmpty } from '@theia/core/lib/common';

export const OPEN_EDITORS_PROPS: TreeProps = {
    ...defaultTreeProps,
    virtualized: false,
};
@injectable()
export class OpenEditorsWidget extends FileTreeWidget {
    static ID = 'theia-open-editors-widget';
    static LABEL = 'Open Editors';

    static PREFIX_ICON_CLASS = 'open-editors-prefix-icon';

    @inject(ApplicationShell) protected readonly applicationShell: ApplicationShell;

    static createContainer(parent: interfaces.Container): Container {
        const child = createFileTreeContainer(parent);

        child.unbind(FileTreeModel);
        child.bind(OpenEditorsModel).toSelf();
        child.rebind(TreeModel).toService(OpenEditorsModel);

        child.unbind(FileTreeWidget);
        child.bind(OpenEditorsWidget).toSelf();

        child.rebind(TreeProps).toConstantValue(OPEN_EDITORS_PROPS);

        child.bind(OpenEditorsTreeDecoratorService).toSelf().inSingletonScope();
        child.rebind(TreeDecoratorService).toService(OpenEditorsTreeDecoratorService);
        return child;
    }

    static createWidget(parent: interfaces.Container): OpenEditorsWidget {
        return OpenEditorsWidget.createContainer(parent).get(OpenEditorsWidget);
    }

    constructor(
        @inject(TreeProps) readonly props: TreeProps,
        @inject(OpenEditorsModel) readonly model: OpenEditorsModel,
        @inject(ContextMenuRenderer) protected readonly contextMenuRenderer: ContextMenuRenderer
    ) {
        super(props, model, contextMenuRenderer);
    }

    @postConstruct()
    init(): void {
        super.init();
        this.id = OpenEditorsWidget.ID;
        this.title.label = OpenEditorsWidget.LABEL;
        this.addClass(OpenEditorsWidget.ID);
        this.update();
    }
    protected activeTreeNodePrefixElement: string | undefined | null;

    protected renderNode(node: OpenEditorNode, props: NodeProps): React.ReactNode {
        if (!TreeNode.isVisible(node)) {
            return undefined;
        }
        const attributes = this.createNodeAttributes(node, props);
        const content = <div className={TREE_NODE_CONTENT_CLASS}
            onMouseEnter={this.handleMouseEnter}
            onMouseLeave={this.handleMouseLeave}>
            {this.renderPrefixIcon(node)}
            {this.decorateIcon(node, this.renderIcon(node, props))}
            {this.renderCaptionAffixes(node, props, 'captionPrefixes')}
            {this.renderCaption(node, props)}
            {this.renderCaptionAffixes(node, props, 'captionSuffixes')}
            {this.renderTailDecorations(node, props)}
        </div>;
        return React.createElement('div', attributes, content);
    }

    protected handleMouseEnter = (e: React.MouseEvent<HTMLDivElement>) => this.doHandleMouseEnter(e);
    protected doHandleMouseEnter(e: React.MouseEvent<HTMLDivElement>): void {
        if (e.currentTarget) {
            this.activeTreeNodePrefixElement = e.currentTarget.querySelector(`.${OpenEditorsWidget.PREFIX_ICON_CLASS}`)?.getAttribute('data-id');
            this.update();
        }
    }

    protected handleMouseLeave = (e: React.MouseEvent<HTMLElement>) => this.doHandleMouseLeave(e);
    protected doHandleMouseLeave(e: React.MouseEvent<HTMLElement>): void {
        if (e.currentTarget) {
            this.activeTreeNodePrefixElement = undefined;
            this.update();
        }
    }

    protected renderPrefixIcon(node: OpenEditorNode): React.ReactNode {
        return (<div data-id={node.id}
            onClick={this.closeEditor}
            className={`${OpenEditorsWidget.PREFIX_ICON_CLASS} codicon ${this.getPrefixIconClass(node)}`}
        />);
    }

    protected getPrefixIconClass(node: OpenEditorNode): string {
        const isDirty = (this.getDecorationData(node, 'dirty'))[0];
        const isHighlighedNode = this.activeTreeNodePrefixElement === node.id;
        if (isHighlighedNode) {
            return 'codicon-close';
        } else if (isDirty) {
            return 'codicon-circle-filled';
        }
        return '';
    }

    protected getDecorationData<K extends keyof OpenEditorTreeDecorationData>(node: TreeNode, key: K): OpenEditorTreeDecorationData[K][] {
        return this.getDecorations(node).filter(data => data[key] !== undefined).map(data => data[key]).filter(notEmpty);
    }

    protected getDecorations(node: TreeNode): OpenEditorTreeDecorationData[] {
        // Return type is set to custom DecorationData. This method is to satisfy TS
        return super.getDecorations(node);
    }

    protected closeEditor = async (e: React.MouseEvent<HTMLDivElement>) => this.doCloseEditor(e);
    protected async doCloseEditor(e: React.MouseEvent<HTMLDivElement>): Promise<void> {
        const widgetId = e.currentTarget.getAttribute('data-id');
        if (widgetId) {
            await this.applicationShell.closeWidget(widgetId);
        }
    }

    protected renderFileIcon(node: TreeNode, props: NodeProps): React.ReactNode {
        const icon = this.toNodeIcon(node);
        return icon && <div className={icon + ' file-icon'}></div>;
    }
}

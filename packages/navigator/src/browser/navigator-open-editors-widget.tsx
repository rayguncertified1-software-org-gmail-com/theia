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
    Tree,
    TreeDecoratorService,
    TreeModel,
    TreeNode,
    TreeProps,
    TreeWidget,
    TREE_NODE_CONTENT_CLASS,
    TREE_NODE_SEGMENT_CLASS,
    TREE_NODE_SEGMENT_GROW_CLASS
} from '@theia/core/lib/browser';
import { OpenEditorsModel } from './navigator-open-editors-tree-model';
// import { OpenEditorsTreeDecoratorService } from './navigator-open-editors-decorator-service';
import { createFileTreeContainer, FileStatNode, FileTree, FileTreeModel, FileTreeWidget } from '@theia/filesystem/lib/browser';
import { OpenEditorsTree } from './navigator-open-editors-tree';
import { OpenEditorsTreeDecoratorService } from './navigator-open-editors-decorator-service';
import { notEmpty } from '@theia/core/lib/common';

export const OPEN_EDITORS_PROPS: TreeProps = {
    ...defaultTreeProps,
    // contextMenuPath: NAVIGATOR_CONTEXT_MENU,
    virtualized: false,
    // multiSelect: true,
    // search: true,
    // globalSelection: true
};
@injectable()
export class OpenEditorsWidget extends FileTreeWidget {
    static ID = 'theia-open-editors-widget';
    static LABEL = 'Open Editors';

    @inject(ApplicationShell) protected readonly applicationShell: ApplicationShell;

    static createContainer(parent: interfaces.Container): Container {
        const child = createFileTreeContainer(parent);

        child.unbind(FileTree);
        child.bind(OpenEditorsTree).toSelf();
        child.rebind(Tree).toService(OpenEditorsTree);

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

    protected renderNode(node: FileStatNode, props: NodeProps): React.ReactNode {
        if (!TreeNode.isVisible(node)) {
            return undefined;
        }
        const attributes = this.createNodeAttributes(node, props);
        const content = <div className={TREE_NODE_CONTENT_CLASS}>
            {this.renderCloseIcon(node)}
            {/* {this.renderExpansionToggle(node, props)} */}
            {this.decorateIcon(node, this.renderIcon(node, props))}
            {this.renderCaptionAffixes(node, props, 'captionPrefixes')}
            {this.renderCaption(node, props)}
            {this.renderCaptionAffixes(node, props, 'captionSuffixes')}
            {this.renderTailDecorations(node, props)}
        </div>;
        return React.createElement('div', attributes, content);
    }

    //     <div className={`noWrapInfo ${TREE_NODE_SEGMENT_GROW_CLASS}`} >
    //     <span className='name'>{caption}</span>
    //     <span className='path'>{path}</span>
    // </div>

    protected renderCaption(node: FileStatNode, props: NodeProps): React.ReactNode {
        const tooltip = this.getDecorationData(node, 'tooltip').filter(notEmpty).join(' • ');
        const classes = [TREE_NODE_SEGMENT_CLASS];
        if (!this.hasTrailingSuffixes(node)) {
            classes.push(TREE_NODE_SEGMENT_GROW_CLASS);
        }
        const className = classes.join(' ');
        let attrs = this.decorateCaption(node, {
            className, id: node.id
        });
        if (tooltip.length > 0) {
            attrs = {
                ...attrs,
                title: tooltip
            };
        }
        const children: React.ReactNode[] = [];
        const caption = this.toNodeName(node);
        const highlight = this.getDecorationData(node, 'highlight')[0];
        if (highlight) {
            children.push(this.toReactNode(caption, highlight));
        }
        const searchHighlight = this.searchHighlights ? this.searchHighlights.get(node.id) : undefined;
        if (searchHighlight) {
            children.push(...this.toReactNode(caption, searchHighlight));
        } else if (!highlight) {
            children.push(caption);
        }
        const path = node.uri.parent.relative(node.uri);
        children.push(<span className='tree-node-path'>{path}</span>);
        return <div {...attrs}>{...children}</div>;
    }

    protected renderCloseIcon(node: FileStatNode): React.ReactNode {
        return (<div data-id={node.id}
            onClick={this.closeOpenEditor}
            className={'codicon codicon-close'}
        />);
    }

    protected closeOpenEditor = (e: React.MouseEvent<HTMLDivElement>) => this.doCloseOpenEditor(e);

    protected doCloseOpenEditor(e: React.MouseEvent<HTMLDivElement>): void {
        const widgetId = e.currentTarget.getAttribute('data-id');
        if (widgetId) {
            this.applicationShell.closeWidget(widgetId);
        }
    }

    protected renderFileIcon(node: TreeNode, props: NodeProps): React.ReactNode {
        const icon = this.toNodeIcon(node);
        return icon && <div className={icon + ' file-icon'}></div>;
    }

    protected async doUpdateDecorations(): Promise<void> {
        this.decorations = await this.decoratorService.getDecorations(this.model);
        this.forceUpdate();
        console.log('SENTINEL DECORATIONS', this.decorations);
    }
}

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
import { ApplicationShell, createTreeContainer, defaultTreeProps, NodeProps, TreeDecoratorService, TreeModel, TreeNode, TreeProps, TreeWidget, TREE_NODE_CONTENT_CLASS } from '@theia/core/lib/browser';
import { OpenEditorsModel } from './navigator-open-editors-tree-model';
import { OpenEditorsTreeDecoratorService } from './navigator-open-editors-decorator-service';

export const OPEN_EDITORS_PROPS: TreeProps = {
    ...defaultTreeProps,
    // contextMenuPath: NAVIGATOR_CONTEXT_MENU,
    virtualized: false,
    // multiSelect: true,
    // search: true,
    // globalSelection: true
};
@injectable()
export class OpenEditorsWidget extends TreeWidget {
    static ID = 'open-editors';
    static LABEL = 'Open Editors';

    @inject(ApplicationShell) protected readonly applicationShell: ApplicationShell;

    static createContainer(parent: interfaces.Container): Container {
        const child = createTreeContainer(parent);
        child.bind(OpenEditorsWidget).toSelf();
        child.rebind(TreeWidget).toService(OpenEditorsWidget);
        child.bind(OpenEditorsModel).toSelf();
        child.rebind(TreeModel).toService(OpenEditorsModel);
        child.rebind(TreeProps).toConstantValue(OPEN_EDITORS_PROPS);

        child.bind(OpenEditorsTreeDecoratorService).toSelf().inSingletonScope();
        child.rebind(TreeDecoratorService).toService(OpenEditorsTreeDecoratorService);
        return child;
    }

    static createWidget(parent: interfaces.Container): OpenEditorsWidget {
        return OpenEditorsWidget.createContainer(parent).get(OpenEditorsWidget);
    }

    @postConstruct()
    init(): void {
        super.init();
        this.id = OpenEditorsWidget.ID;
        this.title.label = OpenEditorsWidget.LABEL;
        this.addClass(OpenEditorsWidget.ID);
        this.update();
    }

    protected renderNode(node: TreeNode, props: NodeProps): React.ReactNode {
        if (!TreeNode.isVisible(node)) {
            return undefined;
        }
        const attributes = this.createNodeAttributes(node, props);
        const content = <div className={TREE_NODE_CONTENT_CLASS}>
            {this.renderExpansionToggle(node, props)}
            {this.renderCloseIcon(node)}
            {this.renderFileIcon(node, props)}
            {/* {this.renderCaptionAffixes(node, props, 'captionPrefixes')} */}
            {this.renderCaption(node, props)}
            {/* {this.renderCaptionAffixes(node, props, 'captionSuffixes')}
            {this.renderTailDecorations(node, props)} */}
        </div>;
        return React.createElement('div', attributes, content);
    }

    protected renderCloseIcon(node: TreeNode): React.ReactNode {
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
}

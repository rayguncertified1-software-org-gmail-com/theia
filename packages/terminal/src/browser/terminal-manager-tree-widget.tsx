// *****************************************************************************
// Copyright (C) 2022 Ericsson and others.
//
// This program and the accompanying materials are made available under the
// terms of the Eclipse Public License v. 2.0 which is available at
// http://www.eclipse.org/legal/epl-2.0.
//
// This Source Code may also be made available under the following Secondary
// Licenses when the conditions for such availability set forth in the Eclipse
// Public License v. 2.0 are satisfied: GNU General Public License, version 2
// with the GNU Classpath Exception which is available at
// https://www.gnu.org/software/classpath/license.html.
//
// SPDX-License-Identifier: EPL-2.0 OR GPL-2.0 WITH Classpath-exception-2.0
// *****************************************************************************

import * as React from '@theia/core/shared/react';
import { Container, inject, injectable, interfaces, postConstruct } from '@theia/core/shared/inversify';
import { codicon, createTreeContainer, Message, NodeProps, SelectableTreeNode, TreeModel, TreeNode, TreeWidget } from '@theia/core/lib/browser';
import { TerminalManagerTreeModel, TerminalManagerTreeTypes } from './terminal-manager-tree-model';
import { Emitter } from '@theia/core';
import { TerminalMenus } from './terminal-frontend-contribution';
// import { TerminalMenus } from './terminal-frontend-contribution';

@injectable()
export class TerminalManagerTreeWidget extends TreeWidget {
    static ID = 'terminal-manager-tree-widget';

    static createContainer(parent: interfaces.Container): Container {
        const child = createTreeContainer(parent, { props: { contextMenuPath: TerminalMenus.TERMINAL_MANAGER_TREE_CONTEXT_MENU } });
        child.bind(TerminalManagerTreeModel).toSelf().inSingletonScope();
        child.rebind(TreeModel).to(TerminalManagerTreeModel);
        child.bind(TerminalManagerTreeWidget).toSelf().inSingletonScope();
        return child;
    }

    static createWidget(parent: interfaces.Container): TerminalManagerTreeWidget {
        return TerminalManagerTreeWidget.createContainer(parent).get(TerminalManagerTreeWidget);
    }
    protected onDidChangeEmitter = new Emitter();
    readonly onDidChange = this.onDidChangeEmitter.event;

    @inject(TreeModel) override readonly model: TerminalManagerTreeModel;

    @postConstruct()
    protected override init(): void {
        super.init();
        this.addClass(TerminalManagerTreeWidget.ID);
        this.toDispose.push(this.onDidChangeEmitter);
    }

    protected override toContextMenuArgs(node: SelectableTreeNode): TerminalManagerTreeTypes.ContextMenuArgs | undefined {
        if (TerminalManagerTreeTypes.isPageNode(node) || TerminalManagerTreeTypes.isTerminalNode(node)) {
            return TerminalManagerTreeTypes.toContextMenuArgs(node);
        }
    }

    protected override renderCaption(node: TreeNode, props: NodeProps): React.ReactNode {
        if (TerminalManagerTreeTypes.isTerminalOrPageNode(node) && !!node.isEditing) {
            return (
                <input
                    type='text'
                    className='theia-input rename-node-input'
                    placeholder={this.toNodeName(node)}
                    onBlur={this.handleRenameOnBlur}
                    data-id={node.id}
                    onKeyDown={this.handleRenameOnKeyDown}
                    autoFocus={true}
                />
            );
        }
        return super.renderCaption(node, props);
    }

    protected handleRenameOnBlur = (e: React.FocusEvent<HTMLInputElement>): void => this.doHandleRenameOnBlur(e);
    protected doHandleRenameOnBlur(e: React.FocusEvent<HTMLInputElement>): void {
        const { value } = e.currentTarget;
        const id = e.currentTarget.getAttribute('data-id');
        if (value && id) {
            this.model.acceptRename(id, value);
        }
    }

    protected handleRenameOnKeyDown = (e: React.KeyboardEvent<HTMLInputElement>): void => this.doHandleRenameOnKeyDown(e);
    protected doHandleRenameOnKeyDown(e: React.KeyboardEvent<HTMLInputElement>): void {
        // TODO escape and enter might not be handled well
        if (e.key === 'Enter' || e.key === 'Tab') {
            const { value } = e.currentTarget;
            const id = e.currentTarget.getAttribute('data-id');
            if (value && id) {
                this.model.acceptRename(id, value);
            }
        }
    }

    protected override renderIcon(node: TreeNode, props: NodeProps): React.ReactNode {
        if (TerminalManagerTreeTypes.isTerminalNode(node)) {
            return <span className={`${codicon('terminal')}`} />;
        } else if (TerminalManagerTreeTypes.isPageNode(node)) {
            return <span className={`${codicon('terminal-tmux')}`} />;
        }
    }

    addPage(): TerminalManagerTreeTypes.PageNode | undefined {
        return this.model.addPage();
    }

    deleteTerminal(node: TerminalManagerTreeTypes.TerminalNode): void {
        this.model.deleteTerminalNode(node);
    }

    toggleRenameTerminal(node: TerminalManagerTreeTypes.TreeNode): void {
        this.model.toggleRenameTerminal(node);
    }

    protected override toNodeName(node: TerminalManagerTreeTypes.TreeNode): string {
        return node.label ?? 'node.id';
    }

    protected override onUpdateRequest(msg: Message): void {
        super.onUpdateRequest(msg);
        this.onDidChangeEmitter.fire(undefined);
    }
}


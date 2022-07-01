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
import {
    codicon,
    CompositeTreeNode,
    createTreeContainer,
    Message,
    NodeProps,
    SelectableTreeNode,
    TreeModel,
    TreeNode,
    TreeWidget,
    TREE_NODE_INDENT_GUIDE_CLASS,
} from '@theia/core/lib/browser';
import { TerminalManagerTreeModel } from './terminal-manager-tree-model';
import { CommandRegistry, CompositeMenuNode, Emitter, MenuModelRegistry } from '@theia/core';
import { TerminalMenus } from './terminal-frontend-contribution';
import { TerminalManagerTreeTypes } from './terminal-manager-types';

@injectable()
export class TerminalManagerTreeWidget extends TreeWidget {
    static ID = 'terminal-manager-tree-widget';

    static createContainer(parent: interfaces.Container): Container {
        const child = createTreeContainer(parent, { props: { leftPadding: 8, contextMenuPath: TerminalMenus.TERMINAL_MANAGER_TREE_CONTEXT_MENU } });
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
    @inject(MenuModelRegistry) protected menuRegistry: MenuModelRegistry;
    @inject(CommandRegistry) protected commandRegistry: CommandRegistry;

    @postConstruct()
    protected override init(): void {
        super.init();
        this.addClass(TerminalManagerTreeWidget.ID);
        this.toDispose.push(this.onDidChangeEmitter);
    }

    protected override toContextMenuArgs(node: SelectableTreeNode): TerminalManagerTreeTypes.ContextMenuArgs | undefined {
        if (TerminalManagerTreeTypes.isPageNode(node) || TerminalManagerTreeTypes.isTerminalNode(node) || TerminalManagerTreeTypes.isTerminalGroupNode(node)) {
            return TerminalManagerTreeTypes.toContextMenuArgs(node);
        }
    }

    protected override renderCaption(node: TreeNode, props: NodeProps): React.ReactNode {
        if (TerminalManagerTreeTypes.isTerminalManagerTreeNode(node) && !!node.isEditing) {
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
        // eslint-disable-next-line no-null/no-null
        if (id) {
            this.model.acceptRename(id, value);
        }
    }

    protected handleRenameOnKeyDown = (e: React.KeyboardEvent<HTMLInputElement>): void => this.doHandleRenameOnKeyDown(e);
    protected doHandleRenameOnKeyDown(e: React.KeyboardEvent<HTMLInputElement>): void {
        // TODO escape and enter might not be handled well
        if (e.key === 'Escape') {
            e.preventDefault();
            e.stopPropagation();
            return;
        }
        if (e.key === 'Enter' || e.key === 'Tab') {
            const { value } = e.currentTarget;
            const id = e.currentTarget.getAttribute('data-id');
            if (value && id) {
                this.model.acceptRename(id, value);
            }
        }
    }

    protected override renderTailDecorations(node: TreeNode, _props: NodeProps): React.ReactNode {
        if (TerminalManagerTreeTypes.isTerminalManagerTreeNode(node)) {
            const inlineActionsForNode = this.resolveInlineActionForNode(node);
            return (
                <div className='terminal-manager-inline-actions-container'>
                    <div className='terminal-manager-inline-actions'>
                        {inlineActionsForNode.map(({ iconClass, commandId, tooltip }) => (
                            <span
                                data-command-id={commandId}
                                data-node-id={node.id}
                                className={iconClass}
                                onClick={this.handleActionItemOnClick}
                                title={tooltip}
                            />
                        ))}
                    </div>
                </div>
            );
        }
    }

    protected handleActionItemOnClick = (e: React.MouseEvent<HTMLSpanElement>): void => this.doHandleActionItemOnClick(e);
    protected doHandleActionItemOnClick(e: React.MouseEvent<HTMLSpanElement>): void {
        const commandId = e.currentTarget.getAttribute('data-command-id');
        const nodeId = e.currentTarget.getAttribute('data-node-id');
        if (commandId && nodeId) {
            const node = this.model.getNode(nodeId);
            if (TerminalManagerTreeTypes.isTerminalManagerTreeNode(node)) {
                const args = TerminalManagerTreeTypes.toContextMenuArgs(node);
                this.commandRegistry.executeCommand(commandId, ...args);
            }
        }
    }

    protected resolveInlineActionForNode(node: TerminalManagerTreeTypes.TerminalManagerTreeNode): TerminalManagerTreeTypes.InlineActionProps[] {
        let menuNode: CompositeMenuNode | undefined = undefined;
        const inlineActionProps: TerminalManagerTreeTypes.InlineActionProps[] = [];
        if (TerminalManagerTreeTypes.isPageNode(node)) {
            menuNode = this.menuRegistry.getMenu(TerminalManagerTreeTypes.PAGE_NODE_MENU);
        } else if (TerminalManagerTreeTypes.isTerminalGroupNode(node)) {
            menuNode = this.menuRegistry.getMenu(TerminalManagerTreeTypes.GROUP_NODE_MENU);
        } else if (TerminalManagerTreeTypes.isTerminalNode(node)) {
            menuNode = this.menuRegistry.getMenu(TerminalManagerTreeTypes.TERMINAL_NODE_MENU);
        }
        if (!menuNode) {
            return [];
        }
        const menuItems = menuNode.children;
        menuItems.forEach(item => {
            const commandId = item.id;
            const command = this.commandRegistry.getCommand(commandId);
            const iconClass = command?.iconClass ? command.iconClass : '';
            const tooltip = command?.label ? command.label : '';
            inlineActionProps.push({ iconClass, tooltip, commandId });
        });
        return inlineActionProps;
    }

    protected override renderIcon(node: TreeNode, props: NodeProps): React.ReactNode {
        if (TerminalManagerTreeTypes.isTerminalNode(node)) {
            return <span className={`${codicon('terminal')}`} />;
        } else if (TerminalManagerTreeTypes.isPageNode(node)) {
            return <span className={`${codicon('terminal-tmux')}`} />;
        } else if (TerminalManagerTreeTypes.isTerminalGroupNode(node)) {
            return <span className={`${codicon('split-vertical')}`} />;
        }
    }

    deleteTerminal(terminalId: TerminalManagerTreeTypes.TerminalId): void {
        this.model.deleteTerminalNode(terminalId);
    }

    protected override toNodeName(node: TerminalManagerTreeTypes.TerminalManagerTreeNode): string {
        return node.label ?? 'node.id';
    }

    protected override onUpdateRequest(msg: Message): void {
        super.onUpdateRequest(msg);
        this.onDidChangeEmitter.fire(undefined);
    }

    // protected override shouldDisplayNode(node: TreeNode): boolean {
    //     if (TerminalManagerTreeTypes.isTerminalGroupNode(node) && node.children.length < 2) {
    //         return false;
    //     } else if (TerminalManagerTreeTypes.isPageNode(node) && this.model.pages.size < 2) {
    //         return false;
    //     }
    //     return super.shouldDisplayNode(node);
    // }

    protected override renderIndent(node: TreeNode, props: NodeProps): React.ReactNode {
        const renderIndentGuides = this.corePreferences['workbench.tree.renderIndentGuides'];
        if (renderIndentGuides === 'none') {
            return undefined;
        }

        const indentDivs: React.ReactNode[] = [];
        let current: TreeNode | undefined = node;
        let depth = props.depth;
        while (current && depth) {
            const classNames: string[] = [TREE_NODE_INDENT_GUIDE_CLASS];
            if (this.needsActiveIndentGuideline(current)) {
                classNames.push('active');
            } else {
                classNames.push(renderIndentGuides === 'onHover' ? 'hover' : 'always');
            }
            const paddingLeft = this.props.leftPadding * depth;
            indentDivs.unshift(<div key={depth} className={classNames.join(' ')} style={{
                paddingLeft: `${paddingLeft}px`
            }} />);
            current = current.parent;
            depth--;
        }
        return indentDivs;
    }

    protected override getDepthForNode(node: TreeNode, depths: Map<CompositeTreeNode | undefined, number>): number {
        const parentDepth = depths.get(node.parent);
        if (TerminalManagerTreeTypes.isTerminalNode(node) && parentDepth === undefined) {
            return 1;
        }
        return super.getDepthForNode(node, depths);
    }

}


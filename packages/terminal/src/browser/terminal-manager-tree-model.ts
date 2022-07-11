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

import { injectable, postConstruct } from '@theia/core/shared/inversify';
import { TreeModelImpl, CompositeTreeNode, SelectableTreeNode, DepthFirstTreeIterator } from '@theia/core/lib/browser';
import { Emitter } from '@theia/core';
import { TerminalManagerTreeTypes } from './terminal-manager-types';

@injectable()
export class TerminalManagerTreeModel extends TreeModelImpl {

    activePageNode: TerminalManagerTreeTypes.PageNode | undefined;
    activeGroupNode: TerminalManagerTreeTypes.TerminalGroupNode | undefined;
    activeTerminalNode: TerminalManagerTreeTypes.TerminalNode | undefined;

    protected pageNum = 1;
    protected groupNum = 1;
    pages = new Set<TerminalManagerTreeTypes.PageNode>();

    protected onTreeSelectionChangedEmitter = new Emitter<TerminalManagerTreeTypes.SelectionChangedEvent>();
    readonly onTreeSelectionChanged = this.onTreeSelectionChangedEmitter.event;

    protected onPageAddedEmitter = new Emitter<{ pageId: TerminalManagerTreeTypes.PageId, terminalKey: TerminalManagerTreeTypes.TerminalKey }>();
    readonly onPageAdded = this.onPageAddedEmitter.event;
    protected onPageDeletedEmitter = new Emitter<TerminalManagerTreeTypes.PageId>();
    readonly onPageDeleted = this.onPageDeletedEmitter.event;

    protected onTerminalGroupAddedEmitter = new Emitter<{
        groupId: TerminalManagerTreeTypes.GroupId,
        pageId: TerminalManagerTreeTypes.PageId,
        terminalKey: TerminalManagerTreeTypes.TerminalKey,
    }>();
    readonly onTerminalGroupAdded = this.onTerminalGroupAddedEmitter.event;
    protected onTerminalGroupDeletedEmitter = new Emitter<TerminalManagerTreeTypes.GroupId>();
    readonly onTerminalGroupDeleted = this.onTerminalGroupDeletedEmitter.event;

    protected onTerminalAddedToGroupEmitter = new Emitter<{
        terminalId: TerminalManagerTreeTypes.TerminalKey,
        groupId: TerminalManagerTreeTypes.GroupId,
    }>();
    readonly onTerminalAddedToGroup = this.onTerminalAddedToGroupEmitter.event;
    protected onTerminalDeletedFromGroupEmitter = new Emitter<{
        terminalId: TerminalManagerTreeTypes.TerminalKey,
        groupId: TerminalManagerTreeTypes.GroupId,
    }>();
    readonly onTerminalDeletedFromGroup = this.onTerminalDeletedFromGroupEmitter.event;

    @postConstruct()
    protected override init(): void {
        super.init();
        this.toDispose.push(this.selectionService.onSelectionChanged(selectionEvent => {
            const selectedNode = selectionEvent.find(node => node.selected);
            if (selectedNode) {
                this.handleSelectionChanged(selectedNode);
            }
        }));
        this.root = { id: 'root', parent: undefined, children: [], visible: false } as CompositeTreeNode;
    }

    protected getContext = () => this;

    addTerminalPage(
        terminalKey: TerminalManagerTreeTypes.TerminalKey,
        groupId: TerminalManagerTreeTypes.GroupId,
        pageId: TerminalManagerTreeTypes.PageId,
    ): void {
        const pageNode = this.createPageNode(pageId);
        const groupNode = this.createGroupNode(groupId, pageId);
        const terminalNode = this.createTerminalNode(terminalKey, groupId);
        if (this.root && CompositeTreeNode.is(this.root)) {
            this.activePageNode = pageNode;
            CompositeTreeNode.addChild(groupNode, terminalNode);
            CompositeTreeNode.addChild(pageNode, groupNode);
            this.root = CompositeTreeNode.addChild(this.root, pageNode);
            this.pages.add(pageNode);
            this.onPageAddedEmitter.fire({ pageId: pageNode.id, terminalKey });
            setTimeout(() => {
                this.selectionService.addSelection(terminalNode);
            });
        }
    }

    protected createPageNode(pageId: TerminalManagerTreeTypes.PageId): TerminalManagerTreeTypes.PageNode {
        return {
            id: pageId,
            label: `Page (${this.pageNum++})`,
            parent: undefined,
            selected: false,
            children: [],
            page: true,
            isEditing: false,
        };
    }

    deleteTerminalPage(pageId: TerminalManagerTreeTypes.PageId): void {
        const pageNode = this.getNode(pageId);
        if (!TerminalManagerTreeTypes.isPageNode(pageNode)) {
            return;
        }
        while (pageNode.children.length > 0) {
            const groupNode = pageNode.children[0];
            if (TerminalManagerTreeTypes.isTerminalGroupNode(groupNode)) {
                this.deleteTerminalGroup(groupNode.id);
            }
        }
        if (this.root && CompositeTreeNode.is(this.root)) {
            this.onPageDeletedEmitter.fire(pageNode.id);
            // pageNode.panel.dispose();
            CompositeTreeNode.removeChild(this.root, pageNode);
            this.pages.delete(pageNode);
            setTimeout(() => {
                if (CompositeTreeNode.is(this.root) && SelectableTreeNode.is(this.root?.children[0])) {
                    this.selectionService.addSelection(this.root.children[0]);
                }
            });
        }
        this.refresh();
    }

    addTerminalGroup(terminalKey: TerminalManagerTreeTypes.TerminalKey, groupId: TerminalManagerTreeTypes.GroupId, pageId: TerminalManagerTreeTypes.PageId): void {
        const groupNode = this.createGroupNode(groupId, pageId);
        const terminalNode = this.createTerminalNode(terminalKey, groupId);
        if (this.root && this.activePageNode && CompositeTreeNode.is(this.root)) {
            this.onTerminalGroupAddedEmitter.fire({ groupId: groupNode.id, pageId, terminalKey });
            CompositeTreeNode.addChild(groupNode, terminalNode);
            CompositeTreeNode.addChild(this.activePageNode, groupNode);
            this.refresh();
            setTimeout(() => {
                this.selectionService.addSelection(terminalNode);
            });
        }
    }

    protected createGroupNode(groupId: TerminalManagerTreeTypes.GroupId, pageId: TerminalManagerTreeTypes.PageId): TerminalManagerTreeTypes.TerminalGroupNode {
        return {
            id: groupId,
            label: `Group (${this.groupNum++})`,
            parent: undefined,
            selected: false,
            children: [],
            terminalGroup: true,
            isEditing: false,
            parentPageId: pageId,
        };
    }

    deleteTerminalGroup(groupId: TerminalManagerTreeTypes.GroupId): void {
        const groupNode = this.tree.getNode(groupId);
        if (!TerminalManagerTreeTypes.isTerminalGroupNode(groupNode)) {
            return;
        }
        while (groupNode.children.length > 0) {
            const terminalNode = groupNode.children[0];
            if (TerminalManagerTreeTypes.isTerminalNode(terminalNode)) {
                const terminalId = terminalNode.id;
                this.deleteTerminalNode(terminalId);
            }
        }
        const parentPageNode = groupNode.parent;
        if (TerminalManagerTreeTypes.isPageNode(parentPageNode)) {
            this.onTerminalGroupDeletedEmitter.fire(groupId);
            CompositeTreeNode.removeChild(parentPageNode, groupNode);
        }
        this.refresh();
    }

    addTerminal(newTerminalId: TerminalManagerTreeTypes.TerminalKey, groupId: TerminalManagerTreeTypes.GroupId): void {
        const groupNode = this.getNode(groupId);
        if (groupNode && TerminalManagerTreeTypes.isTerminalGroupNode(groupNode)) {
            const terminalNode = this.createTerminalNode(newTerminalId, groupId);
            CompositeTreeNode.addChild(groupNode, terminalNode);
            this.onTerminalAddedToGroupEmitter.fire({ terminalId: newTerminalId, groupId });
            this.refresh();
            setTimeout(() => {
                if (SelectableTreeNode.is(terminalNode)) {
                    this.selectionService.addSelection(terminalNode);
                }
            });
        }
    }

    createTerminalNode(terminalId: TerminalManagerTreeTypes.TerminalKey, groupId: TerminalManagerTreeTypes.GroupId): TerminalManagerTreeTypes.TerminalNode {
        return {
            id: terminalId,
            label: 'Terminal',
            parent: undefined,
            children: [],
            selected: false,
            terminal: true,
            isEditing: false,
            parentGroupId: groupId,
        };
    }

    deleteTerminalNode(terminalId: TerminalManagerTreeTypes.TerminalKey): void {
        const terminalNode = this.getNode(terminalId);
        if (!TerminalManagerTreeTypes.isTerminalNode(terminalNode)) {
            return;
        }
        const parentGroupNode = terminalNode.parent;
        if (TerminalManagerTreeTypes.isTerminalGroupNode(parentGroupNode)) {
            this.onTerminalDeletedFromGroupEmitter.fire({
                terminalId,
                groupId: parentGroupNode.id,
            });
            CompositeTreeNode.removeChild(parentGroupNode, terminalNode);
        }
        this.refresh();
    }

    toggleRenameTerminal(entityId: TerminalManagerTreeTypes.TerminalManagerValidId): void {
        const node = this.getNode(entityId);
        if (TerminalManagerTreeTypes.isTerminalManagerTreeNode(node)) {
            node.isEditing = true;
            this.root = this.root;
        }
    }

    acceptRename(nodeId: string, newName: string): void {
        const node = this.getNode(nodeId);
        if (TerminalManagerTreeTypes.isTerminalManagerTreeNode(node)) {
            const trimmedName = newName.trim();
            node.label = trimmedName === '' ? node.label : newName;
            node.isEditing = false;
            this.root = this.root;
        }
    }

    handleSelectionChanged(selectedNode: SelectableTreeNode): void {
        let activeTerminal: TerminalManagerTreeTypes.TerminalNode | undefined = undefined;
        let activeGroup: TerminalManagerTreeTypes.TerminalGroupNode | undefined = undefined;
        let activePage: TerminalManagerTreeTypes.PageNode | undefined = undefined;

        if (TerminalManagerTreeTypes.isTerminalNode(selectedNode)) {
            activeTerminal = selectedNode;
            const parent = activeTerminal.parent;
            if (TerminalManagerTreeTypes.isTerminalGroupNode(parent)) {
                activeGroup = parent;
                const grandparent = activeGroup.parent;
                if (TerminalManagerTreeTypes.isPageNode(grandparent)) {
                    activePage = grandparent;
                }
            } else if (TerminalManagerTreeTypes.isPageNode(parent)) {
                activePage = parent;
            }
        } else if (TerminalManagerTreeTypes.isTerminalGroupNode(selectedNode)) {
            const parent = selectedNode.parent;
            if (TerminalManagerTreeTypes.isPageNode(parent)) {
                activePage = parent;
            }
        } else if (TerminalManagerTreeTypes.isPageNode(selectedNode)) {
            activePage = selectedNode;
        }

        this.activeTerminalNode = activeTerminal;
        this.activeGroupNode = activeGroup;
        this.activePageNode = activePage;
        this.onTreeSelectionChangedEmitter.fire({
            activePageId: activePage?.id,
            activeTerminalId: activeTerminal?.id,
            activeGroupId: activeGroup?.id
        });
    }

    protected refreshCounts(): void {
        if (!this.root) {
            return;
        }
        const pages = new Set<TerminalManagerTreeTypes.PageNode>();
        for (const node of new DepthFirstTreeIterator(this.root)) {
            if (TerminalManagerTreeTypes.isPageNode(node)) {
                pages.add(node);
            }
        }
        this.pages = pages;
    }

    getPageIdForTerminal(terminalKey: TerminalManagerTreeTypes.TerminalKey): TerminalManagerTreeTypes.PageId | undefined {
        const terminalNode = this.getNode(terminalKey);
        if (!TerminalManagerTreeTypes.isTerminalNode(terminalNode)) {
            return undefined;
        }
        const { parentGroupId } = terminalNode;
        const groupNode = this.getNode(parentGroupId);
        if (!TerminalManagerTreeTypes.isTerminalGroupNode(groupNode)) {
            return undefined;
        }
        return groupNode.parentPageId;
    }
}

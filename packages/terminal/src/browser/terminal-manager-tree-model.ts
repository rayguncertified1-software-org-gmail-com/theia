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
import { TreeModelImpl, CompositeTreeNode, SelectableTreeNode, SplitPanel, DepthFirstTreeIterator } from '@theia/core/lib/browser';
import { Emitter } from '@theia/core';
import { TerminalManager, TerminalManagerTreeTypes } from './terminal-manager-types';
import { TerminalWidget } from './base/terminal-widget';

@injectable()
export class TerminalManagerTreeModel extends TreeModelImpl {

    activePage: TerminalManagerTreeTypes.PageNode | undefined;
    activeGroup: TerminalManagerTreeTypes.TerminalGroupNode | undefined;
    activeTerminal: TerminalManagerTreeTypes.TerminalNode | undefined;

    protected pageNum = 0;
    protected groupNum = 0;
    pages = new Set<TerminalManagerTreeTypes.PageNode>();

    protected onTreeSelectionChangedEmitter = new Emitter<TerminalManagerTreeTypes.SelectionChangedEvent>();
    readonly onTreeSelectionChanged = this.onTreeSelectionChangedEmitter.event;

    protected onPageAddedEmitter = new Emitter<TerminalManagerTreeTypes.PageNode>();
    readonly onPageAdded = this.onPageAddedEmitter.event;

    protected onTerminalGroupAddedEmitter = new Emitter<TerminalManagerTreeTypes.TerminalGroupNode>();
    readonly onTerminalGroupAdded = this.onTerminalGroupAddedEmitter.event;

    protected onTerminalAddedToGroupEmitter = new Emitter<TerminalManagerTreeTypes.TerminalNode>();
    readonly onTerminalAddedToGroup = this.onTerminalAddedToGroupEmitter.event;

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

    getLayoutData(): TerminalManager.LayoutData {
        const pageItems: TerminalManager.TerminalManagerLayoutData = { pageLayouts: [] };
        const fullLayoutData: TerminalManager.LayoutData = {
            type: 'terminal-manager',
            items: pageItems,
        };
        if (this.root && CompositeTreeNode.is(this.root)) {
            const pageNodes = this.root.children;
            for (const pageNode of pageNodes) {
                if (TerminalManagerTreeTypes.isPageNode(pageNode)) {
                    const groupNodes = pageNode.children;
                    const pagePanel = pageNode.panel;
                    const pageLayoutData: TerminalManager.PageLayoutData = {
                        groupLayouts: [],
                        label: pageNode.label,
                        groupRelativeWidths: pagePanel.relativeSizes(),
                    };
                    for (let groupIndex = 0; groupIndex < groupNodes.length; groupIndex++) {
                        const groupNode = groupNodes[groupIndex];
                        const groupPanel = groupNode.panel;
                        if (TerminalManagerTreeTypes.isTerminalGroupNode(groupNode)) {
                            const groupLayoutData: TerminalManager.TerminalGroupLayoutData = {
                                label: groupNode.label,
                                widgetLayouts: [],
                                widgetRelativeHeights: groupPanel.relativeSizes(),
                            };
                            const widgetNodes = groupNode.children;
                            for (let widgetIndex = 0; widgetIndex < widgetNodes.length; widgetIndex++) {
                                const widgetNode = widgetNodes[widgetIndex];
                                if (TerminalManagerTreeTypes.isTerminalNode(widgetNode)) {
                                    const terminalLayoutData: TerminalManager.TerminalWidgetLayoutData = {
                                        widget: widgetNode.widget,
                                    };
                                    groupLayoutData.widgetLayouts.push(terminalLayoutData);
                                }
                            }
                            pageLayoutData.groupLayouts.push(groupLayoutData);
                        }
                    }
                    pageItems.pageLayouts.push(pageLayoutData);
                }
            }
        }
        console.log('SENTINEL LAYOUT', fullLayoutData);
        return fullLayoutData;
    }

    addTerminalPage(widget: TerminalWidget, groupPanel: SplitPanel, pagePanel: SplitPanel): void {
        const pageNode = this.createPageNode(pagePanel);
        const groupNode = this.createGroupNode(groupPanel);
        const terminalNode = this.createTerminalNode(widget);
        if (this.root && CompositeTreeNode.is(this.root)) {
            this.activePage = pageNode;
            CompositeTreeNode.addChild(groupNode, terminalNode);
            CompositeTreeNode.addChild(pageNode, groupNode);
            this.root = CompositeTreeNode.addChild(this.root, pageNode);
            this.pages.add(pageNode);
            this.onPageAddedEmitter.fire(pageNode);
            setTimeout(() => {
                this.selectionService.addSelection(terminalNode);
            });
        }
    }

    protected createPageNode(pagePanel: SplitPanel): TerminalManagerTreeTypes.PageNode {
        return {
            id: pagePanel.id,
            label: pagePanel.id,
            parent: undefined,
            selected: false,
            children: [],
            page: true,
            isEditing: false,
            panel: pagePanel,
        };
    }

    deleteTerminalPage(pageNode: TerminalManagerTreeTypes.PageNode): void {
        while (pageNode.children.length > 0) {
            const child = pageNode.children[0];
            if (TerminalManagerTreeTypes.isTerminalGroupNode(child)) {
                this.deleteTerminalGroup(child);
            }
        }
        if (this.root && CompositeTreeNode.is(this.root)) {
            pageNode.panel.dispose();
            CompositeTreeNode.removeChild(this.root, pageNode);
            this.pages.delete(pageNode);
            this.refresh();
            setTimeout(() => {
                if (CompositeTreeNode.is(this.root) && SelectableTreeNode.is(this.root?.children[0])) {
                    this.selectionService.addSelection(this.root.children[0]);
                }
            });
        }
    }

    addTerminalGroup(widget: TerminalWidget, groupPanel: SplitPanel): void {
        const groupNode = this.createGroupNode(groupPanel);
        const terminalNode = this.createTerminalNode(widget);
        if (this.root && this.activePage && CompositeTreeNode.is(this.root)) {
            this.onTerminalGroupAddedEmitter.fire(groupNode);
            CompositeTreeNode.addChild(groupNode, terminalNode);
            CompositeTreeNode.addChild(this.activePage, groupNode);
            this.refresh();
            setTimeout(() => {
                this.selectionService.addSelection(terminalNode);
            });
        }
    }

    protected createGroupNode(panel: SplitPanel): TerminalManagerTreeTypes.TerminalGroupNode {
        return {
            id: panel.id,
            label: panel.id,
            parent: undefined,
            selected: false,
            panel,
            children: [],
            terminalGroup: true,
            isEditing: false,
        };
    }

    deleteTerminalGroup(groupNode: TerminalManagerTreeTypes.TerminalGroupNode): void {
        while (groupNode.children.length > 0) {
            const child = groupNode.children[0];
            if (TerminalManagerTreeTypes.isTerminalNode(child)) {
                this.deleteTerminalNode(child);
            }
        }
        const parentPageNode = groupNode.parent;
        if (TerminalManagerTreeTypes.isPageNode(parentPageNode)) {
            groupNode.panel.dispose();
            CompositeTreeNode.removeChild(parentPageNode, groupNode);
            this.refresh();
        }
    }

    addTerminal(terminalWidget: TerminalWidget, terminalId: TerminalManager.TerminalID): void {
        const siblingTerminal = this.getNode(terminalId);
        const parentGroup = siblingTerminal?.parent;
        if (parentGroup && TerminalManagerTreeTypes.isTerminalGroupNode(parentGroup)) {
            const terminalNode = this.createTerminalNode(terminalWidget);
            CompositeTreeNode.addChild(parentGroup, terminalNode);
            this.onTerminalAddedToGroupEmitter.fire(terminalNode);
            this.refresh();
            setTimeout(() => {
                if (SelectableTreeNode.is(terminalNode)) {
                    this.selectionService.addSelection(terminalNode);
                }
            });
        }
    }

    createTerminalNode(widget: TerminalWidget): TerminalManagerTreeTypes.TerminalNode {
        return {
            id: `${widget.id}`,
            label: `${widget.id}`,
            parent: undefined,
            children: [],
            widget,
            selected: false,
            terminal: true,
            isEditing: false,
        };
    }

    deleteTerminalNode(node: TerminalManagerTreeTypes.TerminalNode): void {
        const parentGroup = node.parent;
        if (TerminalManagerTreeTypes.isTerminalNode(node) && TerminalManagerTreeTypes.isTerminalGroupNode(parentGroup)) {
            console.log('SENTINEL BEFORE', parentGroup.panel.widgets);
            node.widget.dispose();
            console.log('SENTINEL AFTER', parentGroup.panel.widgets);
            const { widgets } = parentGroup.panel;
            CompositeTreeNode.removeChild(parentGroup, node);
            this.refresh();
            if (widgets.length === 0) {
                this.deleteTerminalGroup(parentGroup);
            }
        }
    }

    toggleRenameTerminal(node: TerminalManagerTreeTypes.TerminalManagerTreeNode): void {
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

        this.activeTerminal = activeTerminal;
        this.activeGroup = activeGroup;
        this.activePage = activePage;
        this.onTreeSelectionChangedEmitter.fire({ activePage, activeTerminal, activeGroup });
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
}

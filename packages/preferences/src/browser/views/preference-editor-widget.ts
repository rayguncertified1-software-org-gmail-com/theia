/********************************************************************************
 * Copyright (C) 2020 Ericsson and others.
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

/* eslint-disable @typescript-eslint/no-explicit-any */
import { postConstruct, injectable, inject } from '@theia/core/shared/inversify';
import throttle = require('@theia/core/shared/lodash.throttle');
import {
    PreferenceService,
    CompositeTreeNode,
    SelectableTreeNode,
    StatefulWidget,
    TopDownTreeIterator,
    PreferenceChanges,
    ExpandableTreeNode,
} from '@theia/core/lib/browser';
import { unreachable } from '@theia/core/lib/common';
import { BaseWidget, DEFAULT_SCROLL_OPTIONS, } from '@theia/core/lib/browser/widgets/widget';
import { PreferenceTreeModel, PreferenceFilterChangeEvent, PreferenceFilterChangeSource } from '../preference-tree-model';
import { PreferenceNodeRendererFactory, GeneralPreferenceNodeRenderer } from './components/preference-node-renderer';
import { Preference } from '../util/preference-types';
import { COMMONLY_USED_SECTION_PREFIX } from '../util/preference-tree-generator';
import { PreferencesScopeTabBar } from './preference-scope-tabbar-widget';

export interface PreferencesEditorState {
    firstVisibleChildID: string,
}

@injectable()
export class PreferencesEditorWidget extends BaseWidget implements StatefulWidget {
    static readonly ID = 'settings.editor';
    static readonly LABEL = 'Settings Editor';

    scrollOptions = DEFAULT_SCROLL_OPTIONS;

    protected scrollContainer: HTMLDivElement;
    /**
     * Guards against scroll events and selection events looping into each other. Set before this widget initiates a selection.
     */
    protected currentModelSelectionId = '';
    /**
     * Permits the user to expand multiple nodes without each one being collapsed on a new selection.
     */
    protected lastUserSelection = '';
    protected isAtScrollTop = true;
    protected firstVisibleChildID = '';
    protected renderers = new Map<string, GeneralPreferenceNodeRenderer>();
    // The commonly used section will duplicate preference ID's, so we'll keep a separate list of them.
    protected commonlyUsedRenderers = new Map<string, GeneralPreferenceNodeRenderer>();

    @inject(PreferenceService) protected readonly preferenceService: PreferenceService;
    @inject(PreferenceTreeModel) protected readonly model: PreferenceTreeModel;
    @inject(PreferenceNodeRendererFactory) protected readonly rendererFactory: PreferenceNodeRendererFactory;
    @inject(PreferencesScopeTabBar) protected readonly tabbar: PreferencesScopeTabBar;

    @postConstruct()
    protected init(): void {
        this.id = PreferencesEditorWidget.ID;
        this.title.label = PreferencesEditorWidget.LABEL;
        this.addClass('settings-main');
        this.toDispose.pushAll([
            this.preferenceService.onPreferencesChanged(e => this.handlePreferenceChanges(e)),
            this.model.onFilterChanged(e => this.handleFilterChange(e)),
            this.model.onSelectionChanged(e => this.handleSelectionChange(e)),
        ]);
        this.createContainers();
    }

    protected createContainers(): void {
        const innerWrapper = document.createElement('div');
        innerWrapper.classList.add('settings-main-scroll-container');
        this.scrollContainer = innerWrapper;
        innerWrapper.addEventListener('scroll', this.onScroll, { passive: true });
        this.node.appendChild(innerWrapper);
        const noLeavesMessage = document.createElement('div');
        noLeavesMessage.classList.add('settings-no-results-announcement');
        noLeavesMessage.textContent = 'That search query has returned no results.';
        this.node.appendChild(noLeavesMessage);
    }

    protected handleFilterChange(e: PreferenceFilterChangeEvent): void {
        const { isFiltered } = this.model;
        const currentFirstVisible = this.firstVisibleChildID;
        if (e.source === PreferenceFilterChangeSource.Search) {
            this.handleSearchChange(isFiltered);
        } else if (e.source === PreferenceFilterChangeSource.Scope) {
            this.handleScopeChange(isFiltered);
        } else if (e.source === PreferenceFilterChangeSource.Schema) {
            this.handleSchemaChange(isFiltered);
        } else {
            unreachable(e.source, 'Not all PreferenceFilterChangeSource enum variants handled.');
        }
        this.resetScroll(currentFirstVisible, e.source === PreferenceFilterChangeSource.Search && !isFiltered);
    }

    protected handleSchemaChange(isFiltered: boolean): void {
        for (const [id, renderer, collection] of this.allRenderers()) {
            if (!this.model.getNode(renderer.nodeId)) {
                renderer.dispose();
                collection.delete(id);
            }
        }
        if (this.model.root) {
            const nodeIterator = Array.from(this.scrollContainer.children)[Symbol.iterator]();
            let nextNode: HTMLElement | undefined = nodeIterator.next().value;
            for (const node of new TopDownTreeIterator(this.model.root)) {
                if (Preference.TreeNode.is(node)) {
                    const { collection, id } = this.analyzeIDAndGetRendererGroup(node.id);
                    const renderer = collection.get(id) ?? this.rendererFactory(node);
                    if (!renderer.node.parentElement) { // If it hasn't been attached yet, it hasn't been checked for the current search.
                        this.hideIfFailsFilters(renderer, isFiltered);
                        collection.set(id, renderer);
                    }
                    if (nextNode !== renderer.node) {
                        if (nextNode) {
                            renderer.insertBefore(nextNode);
                        } else {
                            renderer.appendTo(this.scrollContainer);
                        }
                    } else {
                        nextNode = nodeIterator.next().value;
                    }
                }
            }
        }
    }

    protected handleScopeChange(isFiltered: boolean = this.model.isFiltered): void {
        for (const [, renderer] of this.allRenderers()) {
            const isHidden = this.hideIfFailsFilters(renderer, isFiltered);
            if (isFiltered || !isHidden) {
                renderer.handleScopeChange?.(isFiltered);
            }
        }
    }

    protected handleSearchChange(isFiltered: boolean): void {
        const noLeavesVisible = this.model.totalVisibleLeaves === 0;
        this.node.classList.toggle('no-results', noLeavesVisible);
        this.scrollContainer.classList.toggle('hidden', noLeavesVisible);
        if (!noLeavesVisible) {
            for (const [, renderer] of this.allRenderers()) {
                const isHidden = this.hideIfFailsFilters(renderer, isFiltered);
                if (!isHidden) {
                    renderer.handleSearchChange?.(isFiltered);
                }
            }
        }
    }

    protected *allRenderers(): IterableIterator<[string, GeneralPreferenceNodeRenderer, Map<string, GeneralPreferenceNodeRenderer>]> {
        for (const [id, renderer] of this.commonlyUsedRenderers.entries()) {
            yield [id, renderer, this.commonlyUsedRenderers];
        }
        for (const [id, renderer] of this.renderers.entries()) {
            yield [id, renderer, this.renderers];
        }
    }

    protected handlePreferenceChanges(e: PreferenceChanges): void {
        for (const id of Object.keys(e)) {
            this.commonlyUsedRenderers.get(id)?.handleValueChange?.();
            this.renderers.get(id)?.handleValueChange?.();
        }
    }

    /**
     * @returns true if the renderer is hidden, false otherwise.
     */
    protected hideIfFailsFilters(renderer: GeneralPreferenceNodeRenderer, isFiltered: boolean): boolean {
        const row = this.model.currentRows.get(renderer.nodeId);
        if (!row || (CompositeTreeNode.is(row.node) && (isFiltered || row.visibleChildren === 0))) {
            renderer.hide();
            return true;
        } else {
            renderer.show();
            return false;
        }
    }

    protected resetScroll(nodeIDToScrollTo?: string, filterWasCleared: boolean = false): void {
        if (this.scrollBar) { // Absent on widget creation
            this.doResetScroll(nodeIDToScrollTo, filterWasCleared);
        } else {
            const interval = setInterval(() => {
                if (this.scrollBar) {
                    clearInterval(interval);
                    this.doResetScroll(nodeIDToScrollTo, filterWasCleared);
                }
            }, 500);
        }
    }

    protected doResetScroll(nodeIDToScrollTo?: string, filterWasCleared: boolean = false): void {
        requestAnimationFrame(() => {
            this.scrollBar?.update();
            if (!filterWasCleared && nodeIDToScrollTo) {
                const { id, collection } = this.analyzeIDAndGetRendererGroup(nodeIDToScrollTo);
                const renderer = collection.get(id);
                if (renderer?.visible) {
                    renderer.node.scrollIntoView();
                    return;
                }
            }
            this.scrollContainer.scrollTop = 0;
        });
    };

    protected doOnScroll(): void {
        const { scrollContainer } = this;
        const firstVisibleChildID = this.findFirstVisibleChildID();
        this.setFirstVisibleChildID(firstVisibleChildID);
        if (this.isAtScrollTop && scrollContainer.scrollTop !== 0) {
            this.isAtScrollTop = false;
            this.tabbar.toggleShadow(true);
        } else if (!this.isAtScrollTop && scrollContainer.scrollTop === 0) {
            this.isAtScrollTop = true;
            this.tabbar.toggleShadow(false);
        }
    };

    onScroll = throttle(this.doOnScroll.bind(this), 50);

    protected findFirstVisibleChildID(): string | undefined {
        const { scrollTop } = this.scrollContainer;
        for (const [, renderer] of this.allRenderers()) {
            const { offsetTop, offsetHeight } = renderer.node;
            if (Math.abs(offsetTop - scrollTop) <= offsetHeight / 2) {
                return renderer.nodeId;
            }
        }
    }

    protected setFirstVisibleChildID(id?: string): void {
        if (id && id !== this.firstVisibleChildID) {
            this.firstVisibleChildID = id;
            let currentNode = this.model.getNode(id);
            let expansionAncestor;
            let selectionAncestor;
            while (currentNode && (!expansionAncestor || !selectionAncestor)) {
                if (!selectionAncestor && SelectableTreeNode.is(currentNode)) {
                    selectionAncestor = currentNode;
                }
                if (!expansionAncestor && ExpandableTreeNode.is(currentNode)) {
                    expansionAncestor = currentNode;
                }
                currentNode = currentNode.parent;
            }
            if (selectionAncestor) {
                this.currentModelSelectionId = selectionAncestor.id;
                expansionAncestor = expansionAncestor ?? selectionAncestor;
                this.model.selectIfNotSelected(selectionAncestor);
                if (!this.model.isFiltered && id !== this.lastUserSelection) {
                    this.lastUserSelection = '';
                    this.model.collapseAllExcept(expansionAncestor);
                }
            }
        }
    }

    protected handleSelectionChange(selectionEvent: readonly Readonly<SelectableTreeNode>[]): void {
        const node = selectionEvent[0];
        if (node && node.id !== this.currentModelSelectionId) {
            this.currentModelSelectionId = node.id;
            this.lastUserSelection = node.id;
            if (this.model.isFiltered && CompositeTreeNode.is(node)) {
                for (const candidate of new TopDownTreeIterator(node, { pruneSiblings: true })) {
                    const { id, collection } = this.analyzeIDAndGetRendererGroup(candidate.id);
                    const renderer = collection.get(id);
                    if (renderer?.visible) {
                        // When filtered, treat the first visible child as the selected node, since it will be the one scrolled to.
                        this.lastUserSelection = renderer.nodeId;
                        renderer.node.scrollIntoView();
                        return;
                    }
                }
            } else {
                const { id, collection } = this.analyzeIDAndGetRendererGroup(node.id);
                const renderer = collection.get(id);
                renderer?.node.scrollIntoView();
            }
        }
    }

    protected analyzeIDAndGetRendererGroup(nodeID: string): { id: string, group: string, collection: Map<string, GeneralPreferenceNodeRenderer> } {
        const { id, group } = Preference.TreeNode.getGroupAndIdFromNodeId(nodeID);
        const collection = group === COMMONLY_USED_SECTION_PREFIX ? this.commonlyUsedRenderers : this.renderers;
        return { id, group, collection };
    }

    protected getScrollContainer(): HTMLElement {
        return this.scrollContainer;
    }

    storeState(): PreferencesEditorState {
        return {
            firstVisibleChildID: this.firstVisibleChildID,
        };
    }

    restoreState(oldState: PreferencesEditorState): void {
        this.firstVisibleChildID = oldState.firstVisibleChildID;
        this.resetScroll(this.firstVisibleChildID);
    }
}
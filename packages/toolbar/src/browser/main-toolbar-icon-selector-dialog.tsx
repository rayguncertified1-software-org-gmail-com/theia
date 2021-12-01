/********************************************************************************
 * Copyright (C) 2022 Ericsson and others.
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

import * as React from '@theia/core/shared/react';
import * as ReactDOM from '@theia/core/shared/react-dom';
import { injectable, interfaces, inject, postConstruct } from '@theia/core/shared/inversify';
import debounce = require('@theia/core/shared/lodash.debounce');
import { ReactDialog } from '@theia/core/lib/browser/dialogs/react-dialog';
import { DEFAULT_SCROLL_OPTIONS, DialogProps, Message } from '@theia/core/lib/browser';
import { Command, Disposable } from '@theia/core';
import { FileService } from '@theia/filesystem/lib/browser/file-service';
import { Deferred } from '@theia/core/lib/common/promise-util';
import PerfectScrollbar from 'perfect-scrollbar';
import { FuzzySearch } from '@theia/core/lib/browser/tree/fuzzy-search';
import { codicons } from './codicons';
import { fontAwesomeIcons } from './font-awesome-icons';
import { IconSet } from './main-toolbar-interfaces';
import { ReactInteraction, ReactKeyboardEvent } from './main-toolbar-constants';

export interface MainToolbarIconDialogFactory {
    (command: Command): MainToolbarIconSelectorDialog;
}

export const MainToolbarIconDialogFactory = Symbol('MainToolbarIconDialogFactory');
export const ToolbarCommand = Symbol('ToolbarCommand');
export const FontAwesomeIcons = Symbol('FontAwesomeIcons');
export const CodiconIcons = Symbol('CodiconIcons');

const FIFTY_MS = 50;
@injectable()
export class MainToolbarIconSelectorDialog extends ReactDialog<string | undefined> {
    @inject(ToolbarCommand) protected readonly toolbarCommand: Command;
    @inject(FileService) protected readonly fileService: FileService;
    @inject(FontAwesomeIcons) protected readonly faIcons: string[];
    @inject(CodiconIcons) protected readonly codiconIcons: string[];
    @inject(FuzzySearch) protected readonly fuzzySearch: FuzzySearch;

    static ID = 'main-toolbar-icon-selector-dialog';
    protected deferredScrollContainer = new Deferred<HTMLDivElement>();
    scrollOptions: PerfectScrollbar.Options = { ...DEFAULT_SCROLL_OPTIONS };
    protected filterRef: HTMLInputElement;

    protected selectedIcon: string | undefined;
    protected activeIconPrefix: IconSet = IconSet.CODICON;
    protected iconSets = new Map<string, string[]>();
    protected filteredIcons: string[] = [];
    protected doShowFilterPlaceholder = false;
    protected debounceHandleSearch = debounce(this.doHandleSearch.bind(this), FIFTY_MS, { trailing: true });

    constructor(
        @inject(DialogProps) protected readonly props: DialogProps,
    ) {
        super(props);
        this.toDispose.push(Disposable.create(() => {
            ReactDOM.unmountComponentAtNode(this.controlPanel);
        }));
    }

    protected onUpdateRequest(msg: Message): void {
        super.onUpdateRequest(msg);
        ReactDOM.render(this.renderControls(), this.controlPanel);
    }

    @postConstruct()
    protected init(): void {
        this.node.id = MainToolbarIconSelectorDialog.ID;
        this.iconSets.set(IconSet.FA, this.faIcons);
        this.iconSets.set(IconSet.CODICON, this.codiconIcons);
        this.activeIconPrefix = IconSet.CODICON;
        const initialIcons = this.iconSets.get(this.activeIconPrefix);
        if (initialIcons) {
            this.filteredIcons = initialIcons;
        }
    }

    async getScrollContainer(): Promise<HTMLElement> {
        return this.deferredScrollContainer.promise;
    }

    protected assignScrollContainerRef = (element: HTMLDivElement): void => this.doAssignScrollContainerRef(element);
    protected doAssignScrollContainerRef(element: HTMLDivElement): void {
        this.deferredScrollContainer.resolve(element);
    }

    protected assignFilterRef = (element: HTMLInputElement): void => this.doAssignFilterRef(element);
    protected doAssignFilterRef(element: HTMLInputElement): void {
        this.filterRef = element;
    }

    get value(): string | undefined {
        return this.selectedIcon;
    }

    protected handleSelectOnChange = async (e: React.ChangeEvent<HTMLSelectElement>): Promise<void> => this.doHandleSelectOnChange(e);
    protected async doHandleSelectOnChange(e: React.ChangeEvent<HTMLSelectElement>): Promise<void> {
        const { value } = e.target;
        this.activeIconPrefix = value as IconSet;
        this.filteredIcons = [];
        await this.doHandleSearch();
        this.update();
    }

    protected renderIconSelectorOptions(): React.ReactNode {
        return (
            <div className='icon-selector-options'>
                <div className='icon-set-selector-wrapper'>
                    Icon Set:
                    {' '}
                    <select
                        className='main-toolbar-icon-select theia-select'
                        onChange={this.handleSelectOnChange}
                        defaultValue={IconSet.CODICON}
                    >
                        <option key={IconSet.CODICON} value={IconSet.CODICON}>Codicon</option>
                        <option key={IconSet.FA} value={IconSet.FA}>Font Awesome</option>
                    </select>
                </div>
                <div className='icon-fuzzy-filter'>
                    <input
                        ref={this.assignFilterRef}
                        placeholder='Filter Icons'
                        type='text'
                        className='icon-filter-input theia-input'
                        onChange={this.debounceHandleSearch}
                        spellCheck={false}
                    />
                </div>
            </div>
        );
    }

    protected renderIconGrid(): React.ReactNode {
        return (
            <div
                className='main-toolbar-scroll-container'
                ref={this.assignScrollContainerRef}
            >
                <div
                    className={`main-toolbar-icon-dialog-content ${this.doShowFilterPlaceholder ? '' : 'grid'}`}
                >
                    {!this.doShowFilterPlaceholder ? this.filteredIcons?.map(icon => (
                        <div
                            className='icon-wrapper'
                            key={icon}
                            role='button'
                            onClick={this.handleOnIconClick}
                            onBlur={this.handleOnIconBlur}
                            tabIndex={0}
                            data-id={`${this.activeIconPrefix} ${icon}`}
                            title={icon}
                            onKeyPress={this.handleOnIconClick}
                        >
                            <div className={`${this.activeIconPrefix} ${icon}`} />
                        </div>
                    ))
                        : <div className='search-placeholder'>The search returned no results</div>}
                </div>
            </div>
        );
    }

    protected render(): React.ReactNode {
        return (
            <>
                {this.renderIconSelectorOptions()}
                {this.renderIconGrid()}
            </>
        );
    }

    protected async doHandleSearch(): Promise<void> {
        const query = this.filterRef.value;
        const pattern = query;
        const items = this.iconSets.get(this.activeIconPrefix);
        if (items) {
            if (pattern.length) {
                const transform = (item: string): string => item;
                const filterResults = await this.fuzzySearch.filter({ pattern, items, transform });
                this.filteredIcons = filterResults.map(result => result.item);
                if (!this.filteredIcons.length) {
                    this.doShowFilterPlaceholder = true;
                } else {
                    this.doShowFilterPlaceholder = false;
                }
            } else {
                this.doShowFilterPlaceholder = false;
                this.filteredIcons = items;
            }
            this.update();
        }
    }

    protected handleOnIconClick = (e: ReactInteraction<HTMLDivElement>): void => this.doHandleOnIconClick(e);
    protected doHandleOnIconClick(e: ReactInteraction<HTMLDivElement>): void {
        e.currentTarget.classList.add('selected');
        if (ReactKeyboardEvent.is(e) && e.key !== 'Enter') {
            return;
        }
        const iconId = e.currentTarget.getAttribute('data-id');
        if (iconId) {
            this.selectedIcon = iconId;
            this.update();
        }
    }

    protected handleOnIconBlur = (e: React.FocusEvent<HTMLDivElement>): void => this.doHandleOnIconBlur(e);
    protected doHandleOnIconBlur(e: React.FocusEvent<HTMLDivElement>): void {
        e.currentTarget.classList.remove('selected');
    }

    protected doAccept = (e: ReactInteraction<HTMLButtonElement>): void => {
        const dataId = e.currentTarget.getAttribute('data-id');
        if (dataId === 'default-accept') {
            this.selectedIcon = this.toolbarCommand.iconClass;
        }
        this.accept();
    };

    protected doClose = (): void => {
        this.selectedIcon = undefined;
        this.close();
    };

    protected renderControls(): React.ReactElement {
        return (
            <div className='main-toolbar-icon-controls'>
                <div>
                    {this.toolbarCommand.iconClass
                        && (
                            <button
                                type='button'
                                className='theia-button main'
                                data-id='default-accept'
                                onClick={this.doAccept}
                            >
                                <span>
                                    Use Default Icon:
                                </span>
                                <div className={`main-toolbar-default-icon ${this.toolbarCommand.iconClass}`} />
                            </button>
                        )}
                </div>
                <div>
                    <button
                        type='button'
                        disabled={!this.selectedIcon}
                        className='theia-button main'
                        onClick={this.doAccept}
                    >
                        Select Icon
                    </button>
                    <button
                        type='button'
                        className='theia-button secondary'
                        onClick={this.doClose}
                    >
                        Cancel
                    </button>

                </div>
            </div>
        );
    }

    dispose(): void {
        super.dispose();
    }
}

export const ICON_DIALOG_WIDTH = 600;
export const ICON_DIALOG_PADDING = 24;

export const bindToolbarIconDialog = (bind: interfaces.Bind): void => {
    bind(MainToolbarIconDialogFactory).toFactory(ctx => (command: Command): MainToolbarIconSelectorDialog => {
        const child = ctx.container.createChild();
        child.bind(DialogProps).toConstantValue({
            title: `Select an Icon for "${command.label}"` ?? 'Select an Icon',
            maxWidth: ICON_DIALOG_WIDTH + ICON_DIALOG_PADDING,
        });
        child.bind(FontAwesomeIcons).toConstantValue(fontAwesomeIcons);
        child.bind(CodiconIcons).toConstantValue(codicons);
        child.bind(ToolbarCommand).toConstantValue(command);
        child.bind(FuzzySearch).toSelf().inSingletonScope();
        child.bind(MainToolbarIconSelectorDialog).toSelf().inSingletonScope();
        return child.get(MainToolbarIconSelectorDialog);
    });
};

/********************************************************************************
 * Copyright (C) 2017 TypeFox and others.
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

import URI from '@theia/core/lib/common/uri';
import { LocationService } from './location-service';
import { ReactRenderer } from '@theia/core/lib/browser/widgets/react-renderer';
import * as React from 'react';
import ReactDOM = require('react-dom');
export class LocationListRenderer extends ReactRenderer {

    protected _drives: URI[] | undefined;
    protected doShowTextInput: boolean = false;
    protected lastUniqueTextInputLocation = '';
    constructor(
        protected readonly service: LocationService,
        host?: HTMLElement
    ) {
        super(host);
        this.doLoadDrives();
    }

    protected doAfterRender = (): void => {
        const locationListSelectInput = this.locationList;
        const locationListTextInput = this.locationTextInput;
        if (locationListSelectInput) {
            const currentLocation = this.service.location;
            locationListSelectInput.value = currentLocation ? currentLocation.toString() : '';
        } else if (locationListTextInput) {
            locationListTextInput.focus();
        }
    };

    render(): void {
        ReactDOM.render(<React.Fragment>{this.doRender()}</React.Fragment>, this.host, this.doAfterRender);
    }

    protected readonly handleLocationChanged = (e: React.ChangeEvent<HTMLSelectElement>) => this.onLocationChanged(e);
    protected readonly handleTextInputOnChange = (e: React.ChangeEvent<HTMLInputElement>) => this.onTextInputChanged(e);
    protected readonly handleTextInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => this.onTextInputKeyDown(e);
    protected readonly handleTextInputToggleClick = (e: React.MouseEvent<HTMLSpanElement>) => this.onTextInputToggle();
    protected readonly handleTextInputOnBlur = (e: React.FocusEvent<HTMLInputElement>) => this.onTextInputToggle();
    protected doRender(): React.ReactNode {
        const options = this.collectLocations().map(value => this.renderLocation(value));
        return (
            <>
                { this.doShowTextInput ?
                    <input className={'theia-select ' + LocationListRenderer.Styles.LOCATION_TEXT_INPUT_CLASS} type='text'
                        defaultValue={this.service.location?.path.toString()}
                        onChange={this.handleTextInputOnChange}
                        onKeyDown={this.handleTextInputKeyDown}
                        spellCheck={false}
                        onBlur={this.handleTextInputOnBlur}
                    />
                    : <>
                        <span onClick={this.handleTextInputToggleClick}
                            className={LocationListRenderer.Styles.LOCATION_LIST_TOGGLE_CLASS}
                            tabIndex={0}
                            id={LocationListRenderer.Styles.LOCATION_LIST_TOGGLE_CLASS}
                        >
                            <i className='fa fa-edit' />
                        </span>
                        <select className={'theia-select ' + LocationListRenderer.Styles.LOCATION_LIST_SELECT_CLASS}
                            onChange={this.handleLocationChanged}>
                            {...options}
                        </select>
                    </>
                }
            </>
        );
    }

    protected onTextInputToggle(): void {
        this.doShowTextInput = !this.doShowTextInput;
        this.render();
    };

    /**
     * Collects the available locations based on the currently selected, and appends the available drives to it.
     */
    protected collectLocations(): LocationListRenderer.Location[] {
        const location = this.service.location;
        const locations: LocationListRenderer.Location[] = (!!location ? location.allLocations : []).map(uri => ({ uri }));
        if (this._drives) {
            const drives = this._drives.map(uri => ({ uri, isDrive: true }));
            // `URI.allLocations` returns with the URI without the trailing slash unlike `FileUri.create(fsPath)`.
            // to be able to compare file:///path/to/resource with file:///path/to/resource/.
            const toUriString = (uri: URI) => {
                const toString = uri.toString();
                return toString.endsWith('/') ? toString.slice(0, -1) : toString;
            };
            drives.forEach(drive => {
                const index = locations.findIndex(loc => toUriString(loc.uri) === toUriString(drive.uri));
                // Ignore drives which are already discovered as a location based on the current model root URI.
                if (index === -1) {
                    // Make sure, it does not have the trailing slash.
                    locations.push({ uri: new URI(toUriString(drive.uri)), isDrive: true });
                } else {
                    // This is necessary for Windows to be able to show `/e:/` as a drive and `c:` as "non-drive" in the same way.
                    // `URI.path.toString()` Vs. `URI.displayName` behaves a bit differently on Windows.
                    // https://github.com/eclipse-theia/theia/pull/3038#issuecomment-425944189
                    locations[index].isDrive = true;
                }
            });
        }
        this.doLoadDrives();
        return locations;
    }

    /**
     * Asynchronously loads the drives (if not yet available) and triggers a UI update on success with the new values.
     */
    protected doLoadDrives(): void {
        if (!this._drives) {
            this.service.drives().then(drives => {
                // If the `drives` are empty, something already went wrong.
                if (drives.length > 0) {
                    this._drives = drives;
                    this.render();
                }
            });
        }
    }

    protected renderLocation(location: LocationListRenderer.Location): React.ReactNode {
        const { uri, isDrive } = location;
        const value = uri.toString();
        return <option value={value} key={uri.toString()}>{isDrive ? uri.path.toString() : uri.displayName}</option>;
    }

    protected onLocationChanged(e: React.ChangeEvent<HTMLSelectElement>): void {
        const locationList = this.locationList;
        if (locationList) {
            const value = locationList.value;
            this.lastUniqueTextInputLocation = value;
            const uri = new URI(value);
            this.service.location = uri;
            e.preventDefault();
            e.stopPropagation();
        }
    }

    protected onTextInputChanged(e: React.ChangeEvent<HTMLInputElement>): void {
        const locationTextInput = this.locationTextInput;
        if (locationTextInput) {
            // discount all paths that end in trailing slashes or periods to prevent duplicate paths from
            // being added to location history, and to prevent tree root to be rendered as '' or '.'
            const sanitizedInput = locationTextInput.value.trim().replace(/[\/\\.]*$/, '');
            if (sanitizedInput !== this.lastUniqueTextInputLocation) {
                this.lastUniqueTextInputLocation = sanitizedInput;
                const uri = new URI(sanitizedInput);
                this.service.location = uri;
            }
            e.stopPropagation();
        }
    }

    protected onTextInputKeyDown(e: React.KeyboardEvent<HTMLInputElement>): void {
        if (e.key === 'Enter' || e.key === 'Escape') {
            this.onTextInputToggle();
        }
    }

    get locationList(): HTMLSelectElement | undefined {
        const locationList = this.host.getElementsByClassName(LocationListRenderer.Styles.LOCATION_LIST_SELECT_CLASS)[0];
        if (locationList instanceof HTMLSelectElement) {
            return locationList;
        }
        return undefined;
    }

    get locationTextInput(): HTMLInputElement | undefined {
        const locationTextInput = this.host.getElementsByClassName(LocationListRenderer.Styles.LOCATION_TEXT_INPUT_CLASS)[0];
        if (locationTextInput instanceof HTMLInputElement) {
            return locationTextInput;
        }
        return undefined;
    }

}

export namespace LocationListRenderer {

    export namespace Styles {
        export const LOCATION_LIST_CLASS = 'theia-LocationList';
        export const LOCATION_LIST_TOGGLE_CLASS = 'theia-LocationListToggle';
        export const LOCATION_LIST_SELECT_CLASS = 'theia-LocationListSelect';
        export const LOCATION_TEXT_INPUT_CLASS = 'theia-LocationListInput';
    }

    export interface Location {
        uri: URI;
        isDrive?: boolean;
    }

}

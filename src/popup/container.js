import React, { Component } from 'react'
import PropTypes from 'prop-types'
import qs from 'query-string'

import extractTimeFiltersFromQuery from 'src/util/nlp-time-filter'
import { remoteFunction } from 'src/util/webextensionRPC'
import { isLoggable, getPauseState } from 'src/activity-logger'
import * as blacklistI from 'src/blacklist'
import { getPageDocId, updateArchiveFlag } from './archive-button'
import Popup from './components/Popup'
import Button from './components/Button'
import HistoryPauser from './components/HistoryPauser'
import LinkButton from './components/LinkButton'
import SplitButton from './components/SplitButton'
import { BLACKLIST_BTN_STATE } from './constants'

import styles from './components/Popup.css'
import setUnreadCount from '../util/setUnreadCount'

import { itemBtnBlacklisted } from './components/Button.css'

// import loading from '../../img/loading.gif' // relative path to image 


export const overviewURL = '/overview/overview.html'
export const optionsURL = '/options/options.html'
export const feedbackURL = 'https://www.reddit.com/r/WorldBrain'

setUnreadCount() 
const getBlacklistButtonState = ({ loggable, blacklist }) => {
    if (!blacklist) return BLACKLIST_BTN_STATE.BLACKLISTED
    if (!loggable) return BLACKLIST_BTN_STATE.DISABLED
    return BLACKLIST_BTN_STATE.UNLISTED
}

class PopupContainer extends Component {
    constructor(props) {
        super(props)

        this.state = {
            url: '',
            searchValue: '',
            pauseValue: 20,
            currentTabPageDocId: '',
            blacklistBtn: BLACKLIST_BTN_STATE.DISABLED,
            isPaused: false,
            archiveBtnDisabled: true,
            blacklistChoice: false,
            notifs: [],
            isLoading: false,
            isError: false,
        }

        this.toggleLoggingPause = remoteFunction('toggleLoggingPause')

        this.onArchiveBtnClick = this.onArchiveBtnClick.bind(this)
        this.onSearchChange = this.onSearchChange.bind(this)
        this.onPauseChange = this.onPauseChange.bind(this)
        this.onSearchEnter = this.onSearchEnter.bind(this)
        this.onPauseConfirm = this.onPauseConfirm.bind(this)
    }

    async componentDidMount() {
        const [currentTab] = await browser.tabs.query({ active: true, currentWindow: true })

        // If we can't get the tab data, then can't init action button states
        if (!currentTab || !currentTab.url) { return }

        this.blacklistConfirm = remoteFunction('quickBlacklistConfirm', { tabId: currentTab.id })

        const updateState = newState => this.setState(oldState => ({ ...oldState, ...newState }))
        const noop = f => f // Don't do anything if error; state doesn't change

        updateState({ url: currentTab.url })
        this.getInitPauseState().then(updateState).catch(noop)
        this.getInitBlacklistBtnState(currentTab.url).then(updateState).catch(noop)
        this.getInitArchiveBtnState(currentTab.url).then(updateState).catch(noop)
        
        try {
            console.log("inside componentDidMount12")
            this.setState(state => ({ ...state, isLoading: true })) 
            const res = await setUnreadCount(0)  
            console.log("res", res)
        if (res === 0) {
            this.setState({unread: false})
        } else {
            this.setState({unread: true})
            this.setState(state => ({ ...state, notifs: res }))
        }
           this.setState(state => ({ ...state, notifs, unread: true })) 
        } catch (error) {
           this.setState(state => ({ ...state, isError: true })) 
        } finally {
          this.setState(state => ({ ...state, isLoading: false })) 
        }
    }

    async getInitPauseState() {
        return { isPaused: await getPauseState() }
    }

    async getInitArchiveBtnState(url) {
        const currentTabPageDocId = await getPageDocId(url)
        return {
            currentTabPageDocId,
            archiveBtnDisabled: false,
        }
    }

    async getInitBlacklistBtnState(url) {
        const blacklist = await blacklistI.fetchBlacklist()

        const result = {
            loggable: isLoggable({ url }),
            blacklist: !blacklistI.isURLBlacklisted(url, blacklist),
        }

        return { blacklistBtn: getBlacklistButtonState(result) }
    }

    onBlacklistBtnClick(domain = false) {
        const url = domain ? new URL(this.state.url).hostname : this.state.url

        return event => {
            event.preventDefault()
            blacklistI.addToBlacklist(url)
            this.blacklistConfirm(url)
            window.close()
        }
    }

    onPauseConfirm(event) {
        event.preventDefault()
        const { isPaused, pauseValue } = this.state

        // Tell background script to do on extension level
        this.toggleLoggingPause(pauseValue)

        // Do local level state toggle and reset
        this.setState(state => ({ ...state, isPaused: !isPaused, pauseValue: 20 }))
    }

    onPauseChange(event) {
        const pauseValue = event.target.value
        this.setState(state => ({ ...state, pauseValue }))
    }

    async onArchiveBtnClick(event) {
        event.preventDefault()

        try {
            await updateArchiveFlag(this.state.currentTabPageDocId)
        } catch (error) {
            // Can't do it for whatever reason
        } finally {
            window.close()
        }
    }

    onSearchChange(event) {
        const searchValue = event.target.value
        this.setState(state => ({ ...state, searchValue }))
    }

    onSearchEnter(event) {
        if (event.key === 'Enter') {
            event.preventDefault()

            const { extractedQuery, startDate, endDate } = extractTimeFiltersFromQuery(this.state.searchValue)
            const queryParams = qs.stringify({ query: extractedQuery, startDate, endDate })

            browser.tabs.create({ url: `${overviewURL}?${queryParams}` }) // New tab with query
            window.close() // Close the popup
        }
    }

    renderBlacklistButton() {
        const { blacklistChoice, blacklistBtn } = this.state
        const setBlacklistChoice = () => this.setState(state => ({ ...state, blacklistChoice: true }))

        if (!blacklistChoice) { // Standard blacklist button
            return blacklistBtn === BLACKLIST_BTN_STATE.BLACKLISTED ? (
                <LinkButton href={`${optionsURL}#/settings`} icon='block' btnClass={itemBtnBlacklisted}>
                    Current Page Blacklisted
                </LinkButton>
            ) : (
                <Button icon='block' onClick={setBlacklistChoice} disabled={blacklistBtn === BLACKLIST_BTN_STATE.DISABLED}>
                    Blacklist Current Page
                </Button>
            )
        }

        // Domain vs URL choice button
        return (
            <SplitButton icon='block'>
                <Button onClick={this.onBlacklistBtnClick(true)}>Domain</Button>
                <Button onClick={this.onBlacklistBtnClick(false)}>URL</Button>
            </SplitButton>
        )
    }

    renderPauseChoices() {
        const pauseValueToOption = (val, i) => <option key={i} value={val}>{val === Infinity ? '∞' : val}</option>

        return this.props.pauseValues.map(pauseValueToOption)
    }
    // setUnreadNotifsBadge() {this.setState({unreadNotifsBadge : setUnreadCount(0)});// }
    render() {
        const { searchValue, archiveBtnDisabled, pauseValue, isPaused } = this.state
        return (
            <Popup searchValue={searchValue} onSearchChange={this.onSearchChange} onSearchEnter={this.onSearchEnter}>
                <HistoryPauser
                    onConfirm={this.onPauseConfirm}
                    onChange={this.onPauseChange}
                    value={pauseValue}
                    isPaused={isPaused}
                >
                    {this.renderPauseChoices()}
                </HistoryPauser>
                {this.renderBlacklistButton()}
                <Button icon='archive' onClick={this.onArchiveBtnClick} disabled={archiveBtnDisabled}>
                    Archive Current Page
                </Button>
                <hr />
                <LinkButton href={`${optionsURL}#/settings`} icon='settings'>
                    Settings
                </LinkButton>
                <LinkButton href={`${optionsURL}#/import`} icon='file_download'>
                    Import History &amp; Bookmarks
                </LinkButton>
                <LinkButton href={`${optionsURL}#/notifications`} icon='notifications'>
                  Notifications <span
                      className={
                          this.state.unread ? styles.badge : styles.loadbadge
                      }>{this.state.notifs} 

                      </span>
                </LinkButton>
                <LinkButton>
                  HELLO!
                      <img src='../../img/loading.gif'/>  
                </LinkButton>
                <LinkButton href={feedbackURL} icon='feedback'>
                    Feedback
                </LinkButton>
            </Popup>
        )
    }
}

PopupContainer.propTypes = { pauseValues: PropTypes.arrayOf(PropTypes.number).isRequired }
PopupContainer.defaultProps = { pauseValues: [5, 10, 20, 30, 60, 120, 180, Infinity] }

export default PopupContainer
